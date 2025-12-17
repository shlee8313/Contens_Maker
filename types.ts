
export type LayoutType = 'SINGLE' | 'SPLIT_V' | 'SPLIT_H' | 'TRI_TOP_SPLIT' | 'TRI_BOT_SPLIT' | 'GRID_2X2';

// New Interface for Topics
export interface TopicItem {
  title: string;
  context: string;
  type: 'breaking' | 'viral';
  url?: string; // Source URL link
}

export interface SceneAsset {
  base_id: string;
  audio_filename: string;
  visual_filename: string;
  subtitle_filename: string;
  // Actual data storage (base64 or blob url) for the session
  audio_url?: string;
  visual_url?: string;
  audio_duration?: number;
}

export interface SceneScripts {
  narration: string;
  tts_text?: string; // [NEW] Optimized text for TTS (Hangul pronunciation)
  subtitles: string[]; // Changed from single string to array
  voice_tone: 'excited' | 'serious' | 'calm' | 'whisper';
}

export interface ScenePrompts {
  visual_prompt: string;
  motion_strength: number;
}

export interface ProgressStatus {
  is_script_done: boolean;      // Writer Agent finished
  is_prompt_done: boolean;      // Director Agent finished
  is_image_generated: boolean;  // Artist Agent finished
  is_image_inspected: boolean;  // Vision check complete (Mandatory now)
  is_audio_generated: boolean;  // Voice Agent finished
  is_video_generated: boolean;  // Video Agent finished
}

export interface InspectionData {
  detected_layout: LayoutType;
  panel_count: number;
  description: string;
}

export interface Cut {
  cut_no: number;
  narration: string;
  visual_detail: string;
}

export interface Scene {
  scene_index: number;
  step_phase: string;
  type: 'video' | 'image';
  duration_prediction: number;
  
  assets: SceneAsset;
  scripts: SceneScripts;
  prompts: ScenePrompts;
  progress_status: ProgressStatus;
  
  // Phase 1: New Layout & Inspection Fields
  planned_layout: LayoutType; // Mandatory
  inspection_data?: InspectionData;
  
  // Phase 2: Detailed Cuts (New)
  cuts?: Cut[];
  narration_full?: string;

  // UI State
  isSelected?: boolean;
  isProcessing?: boolean; // Generic processing flag for any agent
  isGeneratingVideo?: boolean;
}

export interface ScriptMeta {
  title: string;
  description: string;
  tags: string[];
  genre: string;
  thumbnail_prompt: string;
  bgm_mood: string;
  timestamp?: number;
}

export interface GlobalStyle {
  art_style: string;
  main_character_desc: string | null;
}

export interface ScriptData {
  meta: ScriptMeta;
  global_style: GlobalStyle;
  scenes: Scene[];
}

export enum ViewState {
  CATEGORY_SELECT = 'CATEGORY_SELECT',
  TOPIC_LIST = 'TOPIC_LIST',
  STYLE_SELECT = 'STYLE_SELECT',
  SCRIPT_VIEW = 'SCRIPT_VIEW',
}
