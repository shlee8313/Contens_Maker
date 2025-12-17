
export interface QuotaStats {
  count: number;
  lastUpdated: number;
  activeModel: string;
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

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Validate shape
                if (typeof parsed === 'object' && parsed !== null) {
                     return { 
                        count: typeof parsed.count === 'number' ? parsed.count : 0, 
                        lastUpdated: parsed.lastUpdated || Date.now(), 
                        activeModel: parsed.activeModel || defaultModel 
                     };
                }
            } catch (e) {
                // Ignore parse error, return default
                console.warn('Failed to parse quota stats, resetting.', e);
            }
        }
        return { count: 0, lastUpdated: Date.now(), activeModel: defaultModel };
    } catch (e) {
        // In case localStorage is disabled or fails
        console.warn('LocalStorage access failed.', e);
        return { count: 0, lastUpdated: Date.now(), activeModel: 'Idle' };
    }
  },

  increment: (modelName: string) => {
    try {
        const today = new Date().toLocaleDateString();
        const key = `${STORAGE_KEY_PREFIX}${today}`;
        
        let currentStats = quotaManager.getStats();
        
        const newStats = {
          count: currentStats.count + 1,
          lastUpdated: Date.now(),
          activeModel: modelName
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
