import React, { useState, useRef, useEffect } from 'react';
import { Search, Hash, Globe, BookOpen, Brain, DollarSign, Heart, Rocket, Upload, Sigma, TrendingUp, Play, Clock, Trash2, ArrowRight, Landmark, PenTool, Sparkles, FileText, FolderOpen } from 'lucide-react';
import { loadProject } from '../services/pipeline';
import { ScriptData } from '../types';
import { del } from 'idb-keyval';

interface TopicSelectorProps {
  onSelectCategory: (category: string) => void;
  onManualScriptSubmit: (text: string) => void;
  onLoadProject: (file: File) => void;
  onResumeProject?: (data: ScriptData) => void;
}

const CATEGORIES = [
  { id: 'WorldNow', label: '세계는 지금', icon: Globe, color: 'text-indigo-300', from: 'from-indigo-500/20', to: 'to-blue-600/20' },
  { id: 'KoreaPolitics', label: '한국정치', icon: Landmark, color: 'text-slate-300', from: 'from-slate-500/20', to: 'to-gray-600/20' },
  { id: 'History', label: '역사', icon: BookOpen, color: 'text-amber-400', from: 'from-amber-500/20', to: 'to-orange-600/20' },
  { id: 'Mystery', label: '미스터리', icon: Search, color: 'text-purple-400', from: 'from-purple-500/20', to: 'to-violet-600/20' },
  { id: 'Economy', label: '경제', icon: DollarSign, color: 'text-emerald-400', from: 'from-emerald-500/20', to: 'to-green-600/20' },
  { id: 'Mathematics', label: '수학', icon: Sigma, color: 'text-indigo-400', from: 'from-indigo-500/20', to: 'to-blue-500/20' },
  { id: 'EconMath', label: '경제와 수학', icon: TrendingUp, color: 'text-teal-400', from: 'from-teal-500/20', to: 'to-cyan-600/20' },
  { id: 'War', label: '전쟁사', icon: Hash, color: 'text-red-400', from: 'from-red-500/20', to: 'to-rose-600/20' },
  { id: 'Psychology', label: '심리', icon: Heart, color: 'text-pink-400', from: 'from-pink-500/20', to: 'to-rose-500/20' },
  { id: 'Space', label: '우주', icon: Rocket, color: 'text-blue-400', from: 'from-blue-500/20', to: 'to-sky-600/20' },
  { id: 'Science', label: '과학', icon: Brain, color: 'text-cyan-400', from: 'from-cyan-500/20', to: 'to-teal-600/20' },
];

const TopicSelector: React.FC<TopicSelectorProps> = ({ onSelectCategory, onManualScriptSubmit, onLoadProject, onResumeProject }) => {
  const [customTopic, setCustomTopic] = useState('');
  const [savedProject, setSavedProject] = useState<ScriptData | null>(null);
  const [inputMode, setInputMode] = useState<'auto' | 'manual'>('auto');
  const [manualScript, setManualScript] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkSaved = async () => {
        try {
            const data = await loadProject();
            if (data && typeof data === 'object') {
                if (!data.scenes) data.scenes = [];
                if (!data.meta) {
                    data.meta = {
                        title: "작업 중인 프로젝트 (제목 없음)",
                        description: "자동 저장된 데이터",
                        genre: "알 수 없음",
                        tags: [],
                        thumbnail_prompt: "",
                        bgm_mood: ""
                    } as any;
                }
                setSavedProject(data);
            }
        } catch (e) {
            console.error("Failed to load saved project", e);
        }
    };
    checkSaved();
  }, []);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customTopic.trim()) {
      onSelectCategory(customTopic);
    }
  };

  const handleManualScriptConfirm = () => {
    if (manualScript.trim().length < 50) {
        alert("대본이 너무 짧습니다. 최소 50자 이상 입력해주세요.");
        return;
    }
    onManualScriptSubmit(manualScript);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoadProject(e.target.files[0]);
    }
  };

  const handleResumeClick = () => {
    if (savedProject && onResumeProject) {
        onResumeProject(savedProject);
    }
  };

  const clearSavedProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("저장된 작업을 삭제하시겠습니까?")) {
        await del('current_project');
        setSavedProject(null);
    }
  };

  const title = savedProject?.meta?.title || "작업 중인 프로젝트";
  const desc = savedProject?.meta?.description || "진행 중인 작업 내용입니다.";
  const sceneCount = savedProject?.scenes?.length || 0;

  const progressPercent = (savedProject && savedProject.scenes && savedProject.scenes.length > 0) ? Math.round(
    (savedProject.scenes.filter(s => s.progress_status?.is_image_generated).length + 
     savedProject.scenes.filter(s => s.progress_status?.is_audio_generated).length) 
    / ((savedProject.scenes.length * 2) || 1) * 100
  ) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 flex flex-col items-center min-h-full">
      
      {/* 1. Header Section */}
      <div className="text-center mb-10 mt-6">
        <h1 className="text-6xl font-black mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 tracking-tighter drop-shadow-sm">
          AI Tube Director
        </h1>
        <p className="text-slate-400 text-lg font-medium">
          트렌드 분석부터 영상 기획, 자산 생성까지. <span className="text-white font-semibold">완전 자동화된 유튜브 제작 파이프라인.</span>
        </p>
      </div>

      {/* Resume Card (Conditional) */}
      {savedProject && (
        <div className="w-full max-w-2xl mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
            <div 
                onClick={handleResumeClick}
                className="bg-slate-900/50 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-5 relative overflow-hidden group hover:bg-slate-800/80 cursor-pointer shadow-[0_0_30px_rgba(16,185,129,0.1)] transition-all"
            >
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                <div className="flex justify-between items-center mb-3">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-bold uppercase tracking-wider animate-pulse mb-1">
                            <Clock className="w-3 h-3" />
                            작업 복구 가능
                        </div>
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {title}
                        </h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={clearSavedProject}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors z-10"
                            title="삭제"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="bg-emerald-600 group-hover:bg-emerald-500 text-white p-2.5 rounded-full shadow-lg group-hover:scale-105 transition-transform">
                            <Play className="w-5 h-5 fill-current pl-0.5" />
                        </div>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>진행률</span>
                        <span>{progressPercent}% ({sceneCount} Scenes)</span>
                    </div>
                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 2. Mode Selector (Segmented Control) */}
      <div className="bg-slate-900/60 p-1.5 rounded-full border border-slate-700/60 inline-flex relative mb-10 shadow-xl backdrop-blur-sm">
        <button
            onClick={() => setInputMode('auto')}
            className={`
                flex items-center gap-2 px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 relative z-10
                ${inputMode === 'auto' ? 'text-white shadow-md' : 'text-slate-400 hover:text-white'}
            `}
        >
            {inputMode === 'auto' && (
                <div className="absolute inset-0 bg-blue-600 rounded-full -z-10 animate-in fade-in zoom-in duration-200" />
            )}
            <Sparkles className="w-4 h-4" />
            Option A: 키워드 기획
        </button>
        <button
            onClick={() => setInputMode('manual')}
            className={`
                flex items-center gap-2 px-8 py-2.5 rounded-full text-sm font-bold transition-all duration-300 relative z-10
                ${inputMode === 'manual' ? 'text-white shadow-md' : 'text-slate-400 hover:text-white'}
            `}
        >
            {inputMode === 'manual' && (
                <div className="absolute inset-0 bg-purple-600 rounded-full -z-10 animate-in fade-in zoom-in duration-200" />
            )}
            <PenTool className="w-4 h-4" />
            Option B: 대본 직접 입력
        </button>
      </div>

      {inputMode === 'auto' ? (
        <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 3. Categories Grid (5-6 cols) */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-12 w-full">
                {CATEGORIES.map((cat) => (
                <button
                    key={cat.id}
                    onClick={() => onSelectCategory(cat.id)}
                    className={`
                        group relative flex flex-col items-center justify-center gap-3 p-5
                        rounded-2xl border border-white/5 bg-slate-800/20 backdrop-blur-md
                        hover:bg-slate-700/40 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]
                        hover:-translate-y-1 transition-all duration-300
                    `}
                >
                    {/* Background Gradient on Hover */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${cat.from} ${cat.to} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                    <div className={`relative p-3 rounded-xl bg-slate-900/50 group-hover:scale-110 transition-transform duration-300 shadow-inner ${cat.color}`}>
                        <cat.icon className="w-6 h-6" />
                    </div>
                    <span className="relative font-bold text-sm text-slate-300 group-hover:text-white transition-colors">{cat.label}</span>
                </button>
                ))}
            </div>

            {/* 4. Search Bar (Custom Topic) */}
            <form onSubmit={handleCustomSubmit} className="relative w-full max-w-2xl group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                    <Search className="w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
                <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="찾으시는 주제가 없나요? 직접 입력해보세요 (예: 양자역학의 비밀)"
                    className="w-full bg-slate-900/80 backdrop-blur border border-slate-700 rounded-full py-4 pl-14 pr-16 text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-lg"
                />
                <button
                    type="submit"
                    disabled={!customTopic.trim()}
                    className="absolute right-2 top-2 bottom-2 aspect-square rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-105 transition-all"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
            </form>
        </div>
      ) : (
        <div className="w-full max-w-4xl animate-in fade-in zoom-in duration-300">
             <div className="bg-slate-800/30 backdrop-blur-md border border-slate-700/50 rounded-3xl p-8 shadow-2xl">
                 <div className="flex items-center gap-2 mb-6 text-purple-400 font-bold uppercase tracking-wider text-xs">
                     <FileText className="w-4 h-4" />
                     대본 직접 입력
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-2">이미 작성된 대본이 있으신가요?</h3>
                 <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                     대본을 붙여넣으시면 <strong>AI Analyzer</strong>가 내용을 분석하여 적절한 태그를 생성하고,<br/>
                     <strong>Splitter</strong>가 최적의 타이밍으로 컷을 분할해줍니다.
                 </p>
                 
                 <textarea
                    value={manualScript}
                    onChange={(e) => setManualScript(e.target.value)}
                    placeholder="영상 대본을 여기에 붙여넣어 주세요 (최소 50자 이상)..."
                    className="w-full h-72 bg-slate-950/50 border border-slate-700 rounded-xl p-5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 mb-6 font-medium leading-relaxed resize-none transition-all"
                />
                 
                 <div className="flex justify-end">
                     <button
                        onClick={handleManualScriptConfirm}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-105 hover:-translate-y-0.5"
                     >
                         <Play className="w-5 h-5 fill-current" />
                         분석 및 생성 시작
                     </button>
                 </div>
             </div>
        </div>
      )}

      {/* 5. Load Project (Drop Zone Style) */}
      <div className="mt-16 w-full max-w-2xl">
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full group flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-slate-500 hover:bg-slate-800/30 transition-all duration-300"
          >
            <div className="p-4 rounded-full bg-slate-800 group-hover:bg-slate-700 transition-colors">
                <FolderOpen className="w-8 h-8 text-slate-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="text-center">
                <p className="text-slate-300 font-bold text-lg group-hover:text-white transition-colors">프로젝트 파일 불러오기</p>
                <p className="text-slate-500 text-sm mt-1">기존에 작업하던 .json 파일을 업로드하여 복구합니다.</p>
            </div>
          </button>
      </div>
    </div>
  );
};

export default TopicSelector;