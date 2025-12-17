
import React, { useEffect, useState } from 'react';
import { quotaManager, QuotaStats } from '../utils/quotaManager';
import { Activity, Server, Zap, ExternalLink, HelpCircle } from 'lucide-react';

const QuotaMonitor: React.FC = () => {
  const [stats, setStats] = useState<QuotaStats>(quotaManager.getStats());
  const limit = quotaManager.getLimit();

  useEffect(() => {
    const handleUpdate = (e: CustomEvent<QuotaStats>) => {
      setStats(e.detail);
    };

    window.addEventListener('quota-update' as any, handleUpdate);
    return () => {
      window.removeEventListener('quota-update' as any, handleUpdate);
    };
  }, []);

  const percentage = Math.min((stats.count / limit) * 100, 100);
  
  // Color logic based on usage
  let statusColor = 'bg-emerald-500';
  let textColor = 'text-emerald-400';
  if (percentage > 50) { statusColor = 'bg-yellow-500'; textColor = 'text-yellow-400'; }
  if (percentage > 80) { statusColor = 'bg-red-500'; textColor = 'text-red-400'; }

  // Model badge color
  const isIdle = stats.activeModel === 'Idle';
  const modelColorClass = stats.activeModel.includes('image') ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 
                          stats.activeModel.includes('tts') ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                          isIdle ? 'bg-slate-700/50 text-slate-500 border-slate-600' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/30';

  return (
    <div className="w-full bg-slate-950 border-b border-slate-800 py-1.5 px-4 flex items-center justify-between text-xs font-mono select-none sticky top-0 z-[100]">
      
      {/* Left: Active Model Indicator */}
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${modelColorClass} transition-colors duration-300`}>
          <Server className="w-3 h-3" />
          <span className="font-bold">{stats.activeModel}</span>
        </div>
        {!isIdle && (
            <div className="hidden sm:flex items-center gap-1 text-slate-400 animate-pulse">
                <Activity className="w-3 h-3" />
                <span>Processing...</span>
            </div>
        )}
      </div>

      {/* Right: Usage Counter & Link */}
      <div className="flex items-center gap-4">
        
        {/* Usage Stats (Local Estimate) */}
        <div className="flex items-center gap-1.5 text-slate-400 group relative cursor-help">
          <Zap className={`w-3 h-3 ${textColor}`} />
          <span className="hidden sm:inline">Local Count:</span>
          <span className={`font-bold ${textColor}`}>{stats.count}</span>
          <span className="text-slate-600">/ {limit} (Daily)</span>
          
          {/* Tooltip */}
          <div className="absolute top-full right-0 mt-2 w-72 p-3 bg-slate-800 border border-slate-700 rounded-lg shadow-xl text-[11px] text-slate-300 hidden group-hover:block z-50 leading-relaxed tracking-tight">
            <p className="mb-2 text-white font-bold border-b border-slate-600 pb-1">
                Gemini 2.5 Flash 무료 티어 기준
            </p>
            <ul className="list-disc pl-3 space-y-1 text-slate-400">
                <li>
                    <strong>하루 1,500회</strong> 통합 요청 가능
                </li>
                <li>
                    <span className="text-emerald-400">이미지</span>, 오디오, 텍스트가 이 한도를 공유합니다.
                    <br/>(이미지 100장은 충분히 가능합니다)
                </li>
                <li>
                    <span className="text-red-400">비디오(Veo)</span>는 무료 티어에서 지원되지 않습니다. (유료 결제 필요)
                </li>
            </ul>
          </div>
        </div>

        {/* Mini Progress Bar */}
        <div className="w-16 sm:w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className={`h-full ${statusColor} transition-all duration-500`} 
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* External Link to Real Dashboard */}
        <div className="w-px h-4 bg-slate-800 mx-1"></div>
        <a 
            href="https://aistudio.google.com/app/plan_information" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            title="구글 공식 대시보드에서 실제 사용량 확인"
        >
            <span className="hidden sm:inline font-bold">실제 사용량 확인</span>
            <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default QuotaMonitor;
