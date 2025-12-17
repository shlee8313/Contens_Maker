import React, { useState } from 'react';
import { ViewState, ScriptData, TopicItem } from './types';
import TopicSelector from './components/TopicSelector';
import TopicList from './components/TopicList';
import StyleSelector from './components/StyleSelector';
import Dashboard from './components/Dashboard';
import { fetchTrendingTopics, generatePerfectScript, generateScriptFromRawText, applyDirectorMode, rewriteScript } from './services/geminiService';
import { saveToIndexedDB } from './services/pipeline';
import { Loader2, AlertTriangle, X } from 'lucide-react';
import QuotaMonitor from './components/QuotaMonitor'; 

const App: React.FC = () => {
  // State
  const [view, setView] = useState<ViewState>(ViewState.CATEGORY_SELECT);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [isTopicsLoading, setIsTopicsLoading] = useState(false);
  const [scriptData, setScriptData] = useState<ScriptData | null>(null);
  const [isScriptLoading, setIsScriptLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  
  // API Error State
  const [apiError, setApiError] = useState<string | null>(null);

  // Handlers
  const handleSelectCategory = async (category: string) => {
    setSelectedCategory(category);
    setView(ViewState.TOPIC_LIST);
    setIsTopicsLoading(true);
    setApiError(null);
    
    try {
      const result = await fetchTrendingTopics(category);
      setTopics(result.topics);
      if (result.error) setApiError(result.error);
    } catch (error) {
      console.error(error);
      alert("주제를 가져오는데 실패했습니다. 다시 시도해주세요.");
      setView(ViewState.CATEGORY_SELECT);
    } finally {
      setIsTopicsLoading(false);
    }
  };

  const handleSelectTopic = async (topic: string) => {
    setIsScriptLoading(true);
    setApiError(null);
    
    try {
      // Use One-Shot Generator
      const data = await generatePerfectScript(
        topic, 
        (msg) => setLoadingStep(msg) // "회의 중..." 메시지 표시
      );
      
      const savedData = await saveToIndexedDB(data);
      setScriptData(savedData);
      
      setView(ViewState.STYLE_SELECT);

    } catch (error: any) {
      console.error(error);
      const msg = error.message || error.toString();
      
      // Since geminiService now translates errors, we can just check for key phrases or display the message directly
      if (msg.includes("할당량") || msg.includes("속도") || msg.includes("Quota") || msg.includes("429")) {
          setApiError(msg);
          setIsScriptLoading(false);
          return;
      }
      alert("대본 생성에 실패했습니다. (AI 응답 오류)");
    } finally {
      setIsScriptLoading(false);
    }
  };

  const handleManualScriptSubmit = async (text: string) => {
      setIsScriptLoading(true);
      setApiError(null);

      try {
        const data = await generateScriptFromRawText(
            text,
            (msg) => setLoadingStep(msg)
        );

        const savedData = await saveToIndexedDB(data);
        setScriptData(savedData);
        setView(ViewState.STYLE_SELECT);

      } catch (error: any) {
        console.error(error);
        const msg = error.message || error.toString();
        if (msg.includes("할당량") || msg.includes("속도") || msg.includes("Quota") || msg.includes("429")) {
             setApiError(msg);
             setIsScriptLoading(false);
             return;
        }
        alert("대본 분석 중 오류가 발생했습니다.");
      } finally {
        setIsScriptLoading(false);
      }
  };

  const handleRewriteScript = async (mode: 'longer' | 'shorter') => {
      if (!scriptData) return;
      
      try {
          const newData = await rewriteScript(scriptData, mode, (msg) => console.log(msg));
          const savedData = await saveToIndexedDB(newData);
          setScriptData(savedData);
      } catch (error: any) {
          console.error("Rewrite failed", error);
          const msg = error.message || error.toString();
          if (msg.includes("할당량") || msg.includes("Quota")) {
              setApiError(msg);
          } else {
              throw error; // Let StyleSelector handle UI alert
          }
      }
  };

  const handleStyleSelected = async (styleName: string, stylePrompt: string) => {
     if (!scriptData) return;

     const directedData = applyDirectorMode(scriptData, styleName, stylePrompt);
     const savedData = await saveToIndexedDB(directedData);
     setScriptData(savedData);

     setView(ViewState.SCRIPT_VIEW);
  };

  const handleLoadProject = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setScriptData(json as ScriptData);
        setView(ViewState.SCRIPT_VIEW);
      } catch (error) {
        alert("잘못된 프로젝트 파일입니다.");
      }
    };
    reader.readAsText(file);
  };

  const handleResumeProject = (data: ScriptData) => {
      setScriptData(data);
      setView(ViewState.SCRIPT_VIEW);
  };

  const handleBackToCategories = () => {
    setScriptData(null);
    setTopics([]);
    setApiError(null);
    setView(ViewState.CATEGORY_SELECT);
  };

  const handleBackToTopics = () => {
    setScriptData(null);
    setApiError(null);
    setView(ViewState.TOPIC_LIST);
  };

  // Render Loading State
  if (isScriptLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <QuotaMonitor />
        <div className="relative mt-8">
          <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
          <Loader2 className="w-16 h-16 text-emerald-500 animate-spin relative z-10" />
        </div>
        <h2 className="mt-8 text-2xl font-bold text-white tracking-tight">AI 총괄 프로듀서</h2>
        <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-emerald-400 font-mono text-lg animate-pulse text-center">
                {loadingStep || "AI 감독관들이 회의 중입니다... (약 30초 소요)"}
            </p>
            <p className="text-slate-500 text-sm">최고의 영상을 위해 설계를 진행하고 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-blue-500/30 flex flex-col">
      {/* [NEW] Quota Monitor Top Bar */}
      <QuotaMonitor />

      {/* API Error Banner */}
      {apiError && (
        <div className="bg-red-500/10 border-b border-red-500/50 p-3 text-center sticky top-8 z-[60] backdrop-blur-md animate-in slide-in-from-top duration-300">
          <p className="text-red-400 font-bold flex items-center justify-center gap-2 text-sm md:text-base">
             <AlertTriangle className="w-5 h-5" /> {apiError}
          </p>
          <button 
            onClick={() => setApiError(null)} 
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-red-400 hover:text-white rounded-full hover:bg-red-500/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 p-4 sticky top-8 bg-slate-900/90 backdrop-blur z-50">
         <div className="max-w-6xl mx-auto flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="font-bold tracking-tight text-slate-200">AI 튜브 디렉터</span>
         </div>
      </header>

      <main className="flex-1 flex flex-col">
        {view === ViewState.CATEGORY_SELECT && (
          <div className="flex-1 flex items-center justify-center">
            <TopicSelector 
              onSelectCategory={handleSelectCategory}
              onManualScriptSubmit={handleManualScriptSubmit}
              onLoadProject={handleLoadProject}
              onResumeProject={handleResumeProject}
            />
          </div>
        )}

        {view === ViewState.TOPIC_LIST && (
          <TopicList 
            category={selectedCategory}
            topics={topics}
            isLoading={isTopicsLoading}
            onSelectTopic={handleSelectTopic}
            onBack={handleBackToCategories}
          />
        )}

        {view === ViewState.STYLE_SELECT && scriptData && (
           <div className="flex-1 flex items-center justify-center">
              <StyleSelector 
                 scriptData={scriptData}
                 onSelectStyle={handleStyleSelected}
                 onRewriteScript={handleRewriteScript}
              />
           </div>
        )}

        {view === ViewState.SCRIPT_VIEW && scriptData && (
          <Dashboard 
            initialData={scriptData}
            onBack={handleBackToCategories} 
          />
        )}
      </main>
    </div>
  );
};

export default App;