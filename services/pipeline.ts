import { get, set } from 'idb-keyval';
import { ScriptData, Scene } from '../types';
import { 
    generateImage, 
    generateSpeech, 
    inspectImage, 
    generateVideo, 
    checkVeoAvailability, 
    splitNarrationInto4Cuts 
} from './geminiService';

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
  
  // Initialize Veo availability once per run
  const veoAvailable = await checkVeoAvailability();

  for (let i = 0; i < scenes.length; i++) {
    if (stopSignal.stopped) break;

    const scene = scenes[i];
    let isDirty = false;

    console.log(`[Construction] Building Scene ${scene.scene_index}...`);

    // 1. Brick Laying (Image) - Wrapped with Retry
    // We always generate a base image first (even for video, it acts as the start frame)
    if (!scene.progress_status.is_image_generated) {
        // Decide layout based on current plan (VIDEO type usually starts as SINGLE then might switch to GRID_2X2 on fallback)
        const layoutToUse = scene.planned_layout;

        const img = await runWithRetry(() => 
            generateImage(scene.prompts.visual_prompt, layoutToUse)
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
        
        scenes[i] = {
            ...scenes[i],
            inspection_data: inspection || { detected_layout: 'SINGLE', panel_count: 1, description: 'Auto-inspection failed' },
            progress_status: { ...scenes[i].progress_status, is_image_inspected: true }
        };
        isDirty = true;
    }

    if (stopSignal.stopped) break;

    // 3. [NEW] Video Generation or 2x2 Grid Fallback
    // Only applies if it's a 'video' type scene and we haven't finalized a video or grid yet
    if (scenes[i].type === 'video' && scenes[i].progress_status.is_image_generated && !scenes[i].progress_status.is_video_generated) {
        
        // Strategy: Try Video -> If Fail/Unavailable -> Split Narration -> Generate 2x2 Grid -> Update Scene
        
        let videoUrl = "";
        if (veoAvailable) {
             videoUrl = await generateVideo(
                 scenes[i].assets.visual_url!, 
                 scenes[i].prompts.motion_strength,
                 scenes[i].duration_prediction
             );
        }

        if (videoUrl) {
            // Video Success
            scenes[i] = {
                ...scenes[i],
                assets: { 
                    ...scenes[i].assets, 
                    visual_url: videoUrl, 
                    visual_filename: scenes[i].assets.visual_filename.replace('.png', '.mp4') 
                },
                progress_status: { ...scenes[i].progress_status, is_video_generated: true }
            };
            console.log(`[Construction] Scene ${i+1}: Video Generated`);
            isDirty = true;

        } else {
            // Fallback: 2x2 Grid + Cut Splitting
            console.warn(`[Construction] Scene ${i+1}: Video unavailable/failed. Falling back to 2x2 Grid.`);

            // A. Split Narration
            const cuts = await runWithRetry(() => 
                splitNarrationInto4Cuts(scenes[i].scripts.narration, scenes[i].prompts.visual_prompt)
            ) || [];

            if (cuts.length > 0) {
                 // B. Create Grid Prompt
                 const gridPrompt = `${scenes[i].prompts.visual_prompt}
                 
                 [2x2 GRID LAYOUT - Storyboard Mode]
                 Panel 1 (Top-Left): ${cuts[0]?.visual_detail || 'Opening shot'}
                 Panel 2 (Top-Right): ${cuts[1]?.visual_detail || 'Development'}
                 Panel 3 (Bottom-Left): ${cuts[2]?.visual_detail || 'Climax'}
                 Panel 4 (Bottom-Right): ${cuts[3]?.visual_detail || 'Conclusion'}
                 
                 Style: Consistent continuous storytelling in 4 panels.`;

                 // C. Generate 2x2 Image
                 const gridImg = await runWithRetry(() => 
                    generateImage(gridPrompt, 'GRID_2X2')
                 );

                 if (gridImg) {
                     scenes[i] = {
                         ...scenes[i],
                         type: 'image', // Downgrade type to image effectively
                         planned_layout: 'GRID_2X2',
                         narration_full: scenes[i].scripts.narration, // Backup full narration
                         cuts: cuts, // Store the split
                         assets: { ...scenes[i].assets, visual_url: gridImg },
                         progress_status: { ...scenes[i].progress_status, is_video_generated: false } // Mark as done via fallback
                     };
                     isDirty = true;
                     console.log(`[Construction] Scene ${i+1}: Fallback 2x2 Grid Generated`);
                 }
            }
        }
    }

    if (stopSignal.stopped) break;

    // 4. Cement Mixing (Audio) - Wrapped with Retry
    if (!scenes[i].progress_status.is_audio_generated) {
        
        // If we split into cuts, we still generate one audio file for the whole narration
        // because syncing 4 audio files to 1 image is complex.
        // We use tts_text or narration_full or narration.
        const textToRead = scenes[i].scripts.tts_text || scenes[i].narration_full || scenes[i].scripts.narration;

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