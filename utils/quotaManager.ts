
export interface QuotaStats {
  count: number;
  lastUpdated: number;
  activeModel: string;
  modelCounts: {
    text: number;
    image: number;
    audio: number;
    video: number;
  };
}

const STORAGE_KEY_PREFIX = 'gemini_quota_';
const MAX_DAILY_LIMIT_ESTIMATE = 1500; // Estimated free tier daily limit for Flash

export const quotaManager = {
  getStats: (): QuotaStats => {
    try {
        const today = new Date().toLocaleDateString();
        const key = `${STORAGE_KEY_PREFIX}${today}`;
        const stored = localStorage.getItem(key);
        
        const defaultModel = 'Idle';
        const defaultCounts = { text: 0, image: 0, audio: 0, video: 0 };

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Validate shape
                if (typeof parsed === 'object' && parsed !== null) {
                     return { 
                        count: typeof parsed.count === 'number' ? parsed.count : 0, 
                        lastUpdated: parsed.lastUpdated || Date.now(), 
                        activeModel: parsed.activeModel || defaultModel,
                        modelCounts: parsed.modelCounts || defaultCounts
                     };
                }
            } catch (e) {
                console.warn('Failed to parse quota stats, resetting.', e);
            }
        }
        return { count: 0, lastUpdated: Date.now(), activeModel: defaultModel, modelCounts: defaultCounts };
    } catch (e) {
        console.warn('LocalStorage access failed.', e);
        return { count: 0, lastUpdated: Date.now(), activeModel: 'Idle', modelCounts: { text: 0, image: 0, audio: 0, video: 0 } };
    }
  },

  increment: (modelName: string) => {
    try {
        const today = new Date().toLocaleDateString();
        const key = `${STORAGE_KEY_PREFIX}${today}`;
        
        let currentStats = quotaManager.getStats();
        
        // Determine type based on model name
        const type = modelName.includes('image') ? 'image' :
                     modelName.includes('tts') ? 'audio' :
                     modelName.includes('veo') ? 'video' : 'text';

        const newStats: QuotaStats = {
          count: currentStats.count + 1,
          lastUpdated: Date.now(),
          activeModel: modelName,
          modelCounts: {
              ...currentStats.modelCounts,
              [type]: (currentStats.modelCounts[type] || 0) + 1
          }
        };

        localStorage.setItem(key, JSON.stringify(newStats));
        
        window.dispatchEvent(new CustomEvent('quota-update', { detail: newStats }));
    } catch (e) {
        console.error('Failed to increment quota', e);
    }
  },

  updateModelStatus: (modelName: string) => {
    try {
        const stats = quotaManager.getStats();
        const newStats = { ...stats, activeModel: modelName };
        const today = new Date().toLocaleDateString();
        const key = `${STORAGE_KEY_PREFIX}${today}`;
        
        localStorage.setItem(key, JSON.stringify(newStats));
        window.dispatchEvent(new CustomEvent('quota-update', { detail: newStats }));
    } catch (e) {
        console.error('Failed to update model status', e);
    }
  },

  getLimit: () => MAX_DAILY_LIMIT_ESTIMATE
};
