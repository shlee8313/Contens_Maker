import { get, set } from 'idb-keyval';
import { ScriptData, Scene } from '../types';
import { generateImage, generateSpeech, inspectImage } from './geminiService';

const DB_KEY = 'current_project';

export async function saveToIndexedDB(data: ScriptData): Promise<ScriptData> {
  try {
    const dataWithTimestamp = { ...data, meta: { ...data.meta, timestamp: Date.now() } };
    await set(DB_KEY, dataWithTimestamp);
    return dataWithTimestamp;
  } catch (err) {
    console.error('[Pipeline] Save Failed', err);
    return data;
  }
}

export async function loadProject(): Promise<ScriptData | null> {
  try {
    return await get<ScriptData>(DB_KEY) || null;
  } catch (err) {
    return null;
  }
}

// --- HELPER: Wait function ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPER: Smart Retry Executor (Exponential Backoff) ---
async function runWithRetry<T>(
  fn: () => Promise<T>, 
  retries = 3, 
  baseDelay = 4000
): Promise<T | null> {
  try {
    return await fn();
  } catch (error: any) {
    const msg = error.message ? error.message.toLowerCase() : error.toString().toLowerCase();

    // [CRITICAL FIX] Stop retries if Daily Quota is exceeded (Checking Korean & English)
    if (msg.includes("quota exceeded") || msg.includes("exceeded quota") || msg.includes("할당량") || msg.includes("quota")) {
        console.error("❌ Daily Quota Exceeded. Stopping retries.");
        throw error; // Re-throw to stop pipeline immediately
    }

    // Retry only on specific transient errors (Rate Limit, Server Error)
    if (retries > 0 && (msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("503") || msg.includes("속도"))) {
      console.warn(`⚠️ API Overload detected! Cooling down for ${baseDelay/1000}s... (Retries left: ${retries})`);
      await wait(baseDelay);
      // Double the delay for the next attempt
      return runWithRetry(fn, retries - 1, baseDelay * 2);
    }
    
    console.error("❌ API Request Final Failure:", error);
    // If it's not a retry-able error or retries exhausted, return null (skip this asset)
    // But if it was a Quota error, we threw above.
    return null;
  }
}

/**
 * CONSTRUCTION PHASE
 * Mechanical loop: Check Missing -> Generate -> Save -> Repeat
 * Enhanced with Smart Retry and Rate Limiting for long-form content.
 */
export async function executeAssetGeneration(
  projectData: ScriptData, 
  onUpdate: (updatedData: ScriptData) => void,
  stopSignal: { stopped: boolean }
): Promise<void> {
  
  const scenes = [...projectData.scenes];
  
  for (let i = 0; i < scenes.length; i++) {
    if (stopSignal.stopped) break;

    const scene = scenes[i];
    let isDirty = false;

    console.log(`[Construction] Building Scene ${scene.scene_index}...`);

    // 1. Brick Laying (Image) - Wrapped with Retry
    if (!scene.progress_status.is_image_generated) {
        const img = await runWithRetry(() => 
            generateImage(scene.prompts.visual_prompt, scene.planned_layout)
        );
        
        if (img) {
            scenes[i] = {
                ...scenes[i],
                assets: { ...scenes[i].assets, visual_url: img },
                progress_status: { ...scenes[i].progress_status, is_image_generated: true }
            };
            isDirty = true;
        }
    }
    
    if (stopSignal.stopped) break;

    // 2. Safety Check (Inspection) - Wrapped with Retry
    if (scenes[i].progress_status.is_image_generated && !scenes[i].progress_status.is_image_inspected) {
        const inspection = await runWithRetry(() => 
            inspectImage(scenes[i].assets.visual_url!)
        );
        
        // If inspection fails (null), use default fallback to keep pipeline moving
        scenes[i] = {
            ...scenes[i],
            inspection_data: inspection || { detected_layout: 'SINGLE', panel_count: 1, description: 'Auto-inspection failed' },
            progress_status: { ...scenes[i].progress_status, is_image_inspected: true }
        };
        isDirty = true;
    }

    if (stopSignal.stopped) break;

    // 3. Cement Mixing (Audio) - Wrapped with Retry
    if (!scenes[i].progress_status.is_audio_generated) {
        
        // [MODIFIED] Use TTS-specific text if available
        const textToRead = scenes[i].scripts.tts_text || scenes[i].scripts.narration;

        const audio = await runWithRetry(() => 
            generateSpeech(textToRead, scenes[i].scripts.voice_tone)
        );
        
        if (audio) {
            scenes[i] = {
                ...scenes[i],
                assets: { ...scenes[i].assets, audio_url: audio },
                progress_status: { ...scenes[i].progress_status, is_audio_generated: true }
            };
            isDirty = true;
        }
    }

    // Save Progress if we built anything in this scene
    if (isDirty) {
        const newData = { ...projectData, scenes };
        onUpdate(newData);
        await saveToIndexedDB(newData);
    }

    // SAFETY DELAY: Prevent Rate Limiting by pausing briefly between scenes
    if (!stopSignal.stopped) {
        await wait(2000); // 2 seconds delay
    }
  }

  console.log('[Construction] All jobs done or stopped.');
}