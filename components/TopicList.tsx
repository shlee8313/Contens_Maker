import React from 'react';
import { ArrowLeft, Sparkles, TrendingUp, Zap, HelpCircle, ExternalLink, Search, Loader2, AlertCircle, Youtube } from 'lucide-react';
import { TopicItem } from '../types';

interface TopicListProps {
  category: string;
  topics: TopicItem[];
  isLoading: boolean;
  onSelectTopic: (topic: string) => void;
  onBack: () => void;
}

const TopicList: React.FC<TopicListProps> = ({ category, topics, isLoading, onSelectTopic, onBack }) => {

  const handleLinkClick = (e: React.MouseEvent, topic: TopicItem) => {
    e.stopPropagation(); // 카드 클릭 이벤트(대본 생성) 방지
    
    let targetUrl = topic.url ? topic.url.trim() : "";

    // 유효성 검사 로직 강화
    const isLikelyUrl = targetUrl && !targetUrl.includes(' ') && targetUrl.includes('.') && targetUrl.length > 4;

    if (!isLikelyUrl) {
        // Fallback: 구글 검색
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(topic.title)}`;
    } else {
        // Protocol 보정
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = `https://${targetUrl}`;
        }

        // [CRITICAL FIX] 1. YouTube Link Handling (Hallucination Fix)
        if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
             targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(topic.title)}`;
        }
        
        // [CRITICAL FIX] 2. Google Grounding Redirect Handling (404 Fix)
        // If the URL is an internal Google grounding path (which causes 404s), force Google Search
        if (targetUrl.includes('grounding-api-redirect') || targetUrl.startsWith('/')) {
             targetUrl = `https://www.google.com/search?q=${encodeURIComponent(topic.title)}`;
        }
    }

    // 새 탭에서 열기
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  // --- 1. LOADING STATE ---
  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-6 min-h-[60vh] flex flex-col">
        <button 
            onClick={onBack}
            className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors self-start"
        >
            <ArrowLeft className="w-4 h-4 mr-2" /> 취소하고 돌아가기
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                <Loader2 className="w-16 h-16 text-blue-400 animate-spin relative z-10" />
            </div>
            
            <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">AI가 트렌드를 분석하고 있습니다</h3>
                <p className="text-slate-400">"{category}" 분야의 최신 뉴스와 바이럴 토픽을 수집 중입니다...</p>
            </div>

            {/* Background Skeleton Grid for visuals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl opacity-30 pointer-events-none mt-10">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-28 bg-slate-800 rounded-xl border border-slate-700 animate-pulse"></div>
                ))}
            </div>
        </div>
      </div>
    );
  }

  // --- 2. EMPTY STATE ---
  if (!isLoading && topics.length === 0) {
    return (
        <div className="w-full max-w-5xl mx-auto p-6 min-h-[60vh] flex flex-col items-center justify-center text-center">
            <div className="bg-slate-800/50 p-6 rounded-full mb-6">
                <AlertCircle className="w-12 h-12 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">검색된 트렌드가 없습니다.</h3>
            <p className="text-slate-400 mb-8 max-w-md">
                "{category}" 카테고리에 대한 최신 정보를 가져오지 못했습니다.<br/>
                일시적인 네트워크 문제이거나 관련 토픽이 부족할 수 있습니다.
            </p>
            <button 
                onClick={onBack}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all hover:scale-105"
            >
                <ArrowLeft className="w-4 h-4" /> 다른 장르 선택하기
            </button>
        </div>
    );
  }

  // --- 3. RESULTS LIST ---
  return (
    <div className="w-full max-w-5xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={onBack}
        className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> 장르 선택으로 돌아가기
      </button>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/20 rounded-lg">
          <TrendingUp className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{category} 관련 트렌드</h2>
          <p className="text-slate-400 text-sm">뉴스 속보(Breaking)와 미스터리/흥미(Viral) 주제를 AI가 분석했습니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topics.map((topic, index) => {
            const isBreaking = topic.type === 'breaking';
            const isYoutube = topic.url && (topic.url.includes('youtube.com') || topic.url.includes('youtu.be'));
            
            return (
            <div
                key={index}
                onClick={() => onSelectTopic(topic.title)}
                className={`
                relative text-left p-5 rounded-xl border transition-all group overflow-hidden cursor-pointer
                ${isBreaking 
                    ? 'bg-slate-800 border-red-900/50 hover:border-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                    : 'bg-slate-800 border-purple-900/50 hover:border-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                }
                `}
            >
                {/* Badge & Link Button */}
                <div className="flex items-center justify-between mb-3">
                {isBreaking ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider border border-red-500/20">
                        <Zap className="w-3 h-3 fill-current" />
                        속보 / 최신
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider border border-purple-500/20">
                        <HelpCircle className="w-3 h-3" />
                        화제 / 미스터리
                    </span>
                )}
                
                <button 
                    onClick={(e) => handleLinkClick(e, topic)}
                    className={`
                        p-1.5 rounded-full hover:bg-white/10 transition-colors z-20 flex items-center gap-1 text-xs font-medium 
                        ${isBreaking ? 'text-red-300 hover:text-red-200' : 'text-purple-300 hover:text-purple-200'}
                    `}
                    title={isYoutube ? "유튜브 검색 결과 보기" : "관련 정보 검색/이동"}
                >
                    {isYoutube ? <Youtube className="w-4 h-4" /> : 
                     (!topic.url || !topic.url.includes('.')) ? <Search className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                    
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:inline-block">
                        {isYoutube ? '유튜브 검색' : 
                         (!topic.url || !topic.url.includes('.')) ? '관련 검색' : '출처 이동'}
                    </span>
                </button>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-blue-300 transition-colors">
                {topic.title}
                </h3>
                
                <p className="text-sm text-slate-400 line-clamp-2">
                {topic.context}
                </p>

                <div className={`
                absolute bottom-0 left-0 h-1 transition-all duration-300 group-hover:w-full w-0
                ${isBreaking ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-gradient-to-r from-purple-600 to-blue-500'}
                `}></div>
            </div>
            );
        })}
      </div>
    </div>
  );
};

export default TopicList;