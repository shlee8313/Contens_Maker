import React, { useState, useEffect } from 'react';
import { ScriptData, Scene } from '../types';
import SceneCard from './SceneCard';
import { generateVisualPlan, generateImage, generateSpeech, generateThumbnail } from '../services/geminiService';
import { saveToIndexedDB } from '../services/pipeline';
import { ArrowLeft, Download, Music, Palette, User, Save, Clapperboard, PenTool, Mic, Image as ImageIcon, Play, AlertTriangle, Copy, X, RefreshCw, LayoutTemplate } from 'lucide-react';
// @ts-ignore
import JSZip from 'jszip';

// Local implementation of saveAs to avoid module resolution issues
const saveAs = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

interface ScriptViewProps {
  data: ScriptData;
  onBack: () => void;
}

const ScriptView: React.FC<ScriptViewProps> = ({ data, onBack }) => {
  const [scenes, setScenes] = useState<Scene[]>(
    data.scenes.map(s => ({
      ...s,
      isSelected: true,
      isProcessing: false,
      progress_status: { 
        is_script_done: true, 
        is_prompt_done: s.progress_status?.is_prompt_done || false, 
        is_image_generated: s.progress_status?.is_image_generated || false, 
        is_image_inspected: s.progress_status?.is_image_inspected || false,
        is_audio_generated: s.progress_status?.is_audio_generated || false,
        is_video_generated: s.progress_status?.is_video_generated || false
      }
    }))
  );

  // Local state for thumbnail to allow regeneration
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(data.meta.thumbnail_url);
  const [isRegeneratingThumb, setIsRegeneratingThumb] = useState(false);

  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  
  // Local Error Banner State
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // --- Auto-Save Effect ---
  useEffect(() => {
    const timer = setTimeout(() => {
        // Include thumbnail update in the save
        const currentData: ScriptData = { 
            ...data, 
            meta: { ...data.meta, thumbnail_url: thumbnailUrl },
            scenes 
        };
        saveToIndexedDB(currentData);
    }, 500); 
    return () => clearTimeout(timer);
  }, [scenes, data, thumbnailUrl]);


  // --- Handlers ---

  const handleToggleSelection = (index: number) => {
    setScenes(prev => prev.map(s => 
      s.scene_index === index ? { ...s, isSelected: !s.isSelected } : s
    ));
  };

  const handleRegenerateThumbnail = async () => {
    if (!data.meta.thumbnail_prompt || isRegeneratingThumb) return;
    setIsRegeneratingThumb(true);
    try {
        const url = await generateThumbnail(data.meta.thumbnail_prompt);
        if (url) {
            setThumbnailUrl(url);
        } else {
            alert("썸네일 생성에 실패했습니다.");
        }
    } catch (e) {
        console.error(e);
        alert("썸네일 생성 중 오류가 발생했습니다.");
    } finally {
        setIsRegeneratingThumb(false);
    }
  };

  const runDirectorAgent = async () => {
    setActiveAgent('Director');
    setErrorBanner(null);
    const scenesToProcess = scenes.filter(s => !s.progress_status.is_prompt_done);
    if (scenesToProcess.length === 0) {
      alert("모든 씬에 이미 프롬프트가 있습니다.");
      setActiveAgent(null);
      return;
    }

    try {
      const updatedScenes = await generateVisualPlan(scenesToProcess, data.global_style);
      setScenes(prev => prev.map(s => {
        const updated = updatedScenes.find(u => u.scene_index === s.scene_index);
        return updated || s;
      }));
    } catch (e: any) {
      alert("Director Agent 작업 중 오류가 발생했습니다.");
    } finally {
      setActiveAgent(null);
    }
  };

  const runArtistAgent = async () => {
    setActiveAgent('Artist');
    setErrorBanner(null);
    
    // NOTE: Limit concurrency to avoid Quota issues, do strictly one by one
    const targets = scenes.filter(s => s.isSelected && s.progress_status.is_prompt_done && !s.progress_status.is_image_generated);
    
    let hasError = false;

    for (const target of targets) {
      if (hasError) break; 
      
      // Safety Delay for Rate Limiting
      if (targets.indexOf(target) > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { ...s, isProcessing: true } : s));
      
      try {
        const imageUrl = await generateImage(target.prompts.visual_prompt, target.planned_layout);
        
        if (imageUrl) {
          setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { 
            ...s, 
            isProcessing: false,
            assets: { ...s.assets, visual_url: imageUrl },
            progress_status: { ...s.progress_status, is_image_generated: true }
          } : s));
        } else {
           setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { ...s, isProcessing: false } : s));
        }
      } catch (e: any) {
        hasError = true;
        console.error(e);
        
        const msg = e.message || e.toString();
        // Check for Korean translated errors or raw errors
        if (msg.includes("할당량") || msg.includes("Quota") || msg.includes("429")) {
            setErrorBanner(msg);
        } else {
            alert("이미지 생성 중 오류가 발생했습니다. (할당량 초과 등)");
        }
        
        setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { ...s, isProcessing: false } : s));
      }
    }
    setActiveAgent(null);
  };

  const runVoiceAgent = async () => {
    setActiveAgent('Voice');
    setErrorBanner(null);
    
    const targets = scenes.filter(s => s.isSelected && !s.progress_status.is_audio_generated);
    let hasError = false;

    for (const target of targets) {
      if (hasError) break;

      // Safety Delay for Rate Limiting
      if (targets.indexOf(target) > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
      }

      setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { ...s, isProcessing: true } : s));
      
      try {
        const audioUrl = await generateSpeech(target.scripts.narration, target.scripts.voice_tone);
        if (audioUrl) {
            setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { 
            ...s, 
            isProcessing: false,
            assets: { ...s.assets, audio_url: audioUrl },
            progress_status: { ...s.progress_status, is_audio_generated: true }
            } : s));
        } else {
            setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { ...s, isProcessing: false } : s));
        }
      } catch (e: any) {
         hasError = true;
         console.error(e);

         const msg = e.message || e.toString();
         if (msg.includes("할당량") || msg.includes("Quota") || msg.includes("429")) {
            setErrorBanner(msg);
         } else {
            alert("오디오 생성 중 오류가 발생했습니다.");
         }

         setScenes(prev => prev.map(s => s.scene_index === target.scene_index ? { ...s, isProcessing: false } : s));
      }
    }
    setActiveAgent(null);
  };

  const handleGenerateVideo = (index: number) => {
    alert("⚠️ 비디오 생성(Veo)은 Google Cloud 유료 결제 계정이 필요합니다.\n현재 무료 버전에서는 시뮬레이션(Placeholder)으로 대체됩니다.");
  };

  const copyThumbnailPrompt = () => {
    navigator.clipboard.writeText(data.meta.thumbnail_prompt);
    alert("썸네일 프롬프트가 복사되었습니다!");
  };

  // --- ZIP DOWNLOAD LOGIC ---
  const handleDownloadZip = async () => {
    setDownloadStatus('압축 중...');
    const zip = new JSZip();
    const assetsFolder = zip.folder("assets");

    // [NEW] Add Thumbnail to Zip
    if (thumbnailUrl && thumbnailUrl.startsWith('data:image')) {
        const thumbData = thumbnailUrl.split(',')[1];
        zip.file("thumbnail.png", thumbData, {base64: true});
    }

    const manifestScenes = scenes.map(s => {
      if (s.assets.visual_url && s.assets.visual_url.startsWith('data:image')) {
        const imgData = s.assets.visual_url.split(',')[1];
        const filename = s.assets.visual_filename || `${s.assets.base_id}.png`;
        const finalFilename = filename.endsWith('.mp4') && s.type === 'image' ? filename.replace('.mp4', '.png') : filename;
        assetsFolder.file(finalFilename, imgData, {base64: true});
      }
      if (s.assets.audio_url && s.assets.audio_url.startsWith('data:audio')) {
        const audioData = s.assets.audio_url.split(',')[1];
        const filename = s.assets.audio_filename || `${s.assets.base_id}.mp3`;
        assetsFolder.file(filename, audioData, {base64: true});
      }
      const { visual_url, audio_url, ...cleanAssets } = s.assets;
      return {
        ...s,
        isSelected: undefined,
        isProcessing: undefined,
        assets: cleanAssets,
        // Include Cuts Info for video editor
        cuts: s.cuts,
        narration_full: s.narration_full
      };
    });

    const manifest = {
      ...data,
      meta: {
          ...data.meta,
          thumbnail_url: thumbnailUrl ? 'thumbnail.png' : undefined 
      },
      scenes: manifestScenes
    };

    zip.file("project.json", JSON.stringify(manifest, null, 2));

    try {
      const content = await zip.generateAsync({type: "blob"});
      const safeTitle = data.meta.title.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 30);
      saveAs(content, `${safeTitle}_project_assets.zip`);
      setDownloadStatus('');
    } catch (e) {
      console.error(e);
      alert("ZIP 생성 중 오류가 발생했습니다.");
      setDownloadStatus('');
    }
  };

  // --- Render ---

  const stats = {
    total: scenes.length,
    prompts: scenes.filter(s => s.progress_status.is_prompt_done).length,
    images: scenes.filter(s => s.progress_status.is_image_generated).length,
    audio: scenes.filter(s => s.progress_status.is_audio_generated).length,
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 pb-20">
      
      {/* LOCAL ERROR BANNER for Asset Generation Steps */}
      {errorBanner && (
        <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg text-center mb-6 animate-in fade-in slide-in-from-top-2 sticky top-20 z-50 backdrop-blur-md">
          <p className="text-red-400 font-bold flex items-center justify-center gap-2 text-sm">
             <AlertTriangle className="w-4 h-4" /> {errorBanner}
          </p>
          <button 
            onClick={() => setErrorBanner(null)} 
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-red-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6 bg-slate-800/80 backdrop-blur p-4 rounded-xl border border-slate-700 sticky top-4 z-40 shadow-lg">
        <button onClick={onBack} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> 뒤로
        </button>

        <div className="flex items-center gap-2">
            {activeAgent && (
                <div className="text-amber-400 text-xs font-bold animate-pulse flex items-center mr-4">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    AI 작업중... 페이지를 닫지 마세요
                </div>
            )}
            <button
            onClick={handleDownloadZip}
            disabled={!!downloadStatus}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-lg shadow-emerald-600/20 transition-all hover:scale-105"
            >
            <Download className="w-4 h-4" />
            {downloadStatus || "전체 저장 (.zip)"}
            </button>
        </div>
      </div>

      {/* Header Info */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 mb-6">
         <h1 className="text-3xl font-bold text-white mb-3">{data.meta.title}</h1>
         <p className="text-slate-400 mb-4 text-sm max-w-2xl">{data.meta.description}</p>
         <div className="flex flex-wrap gap-2 text-xs mb-4">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">{data.meta.genre}</span>
            <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">BGM: {data.meta.bgm_mood}</span>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30">{data.global_style.art_style}</span>
            <span className="px-3 py-1 bg-slate-700 text-slate-300 rounded-full">총 {scenes.length}개 씬</span>
         </div>
         
         {/* Thumbnail Prompt Section [IMPROVED] */}
         {data.meta.thumbnail_prompt && (
             <div className="bg-black/30 p-4 rounded-xl border border-slate-700/50 flex flex-col md:flex-row gap-4">
                 {/* Left: Image Preview */}
                 <div className="w-full md:w-64 aspect-video bg-slate-800 rounded-lg overflow-hidden border border-slate-600 relative group">
                    {thumbnailUrl ? (
                        <img src={thumbnailUrl} alt="Generated Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2">
                             {isRegeneratingThumb ? <RefreshCw className="w-8 h-8 animate-spin text-blue-400"/> : <ImageIcon className="w-8 h-8 opacity-20" />}
                             <span className="text-xs">{isRegeneratingThumb ? "생성 중..." : "이미지 없음"}</span>
                        </div>
                    )}
                 </div>

                 {/* Right: Info & Actions */}
                 <div className="flex-1 flex flex-col justify-between py-1">
                     <div>
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" /> 썸네일 (YouTube Thumbnail)
                            </h4>
                            <button 
                                onClick={handleRegenerateThumbnail}
                                disabled={isRegeneratingThumb}
                                className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${isRegeneratingThumb ? 'animate-spin' : ''}`} />
                                {thumbnailUrl ? '다시 만들기' : '이미지 생성'}
                            </button>
                        </div>
                        <p className="text-xs text-slate-300 font-mono bg-slate-900/50 p-3 rounded border border-slate-800 line-clamp-3">
                            {data.meta.thumbnail_prompt}
                        </p>
                     </div>
                     
                     <div className="flex justify-end mt-2">
                        <button 
                            onClick={copyThumbnailPrompt}
                            className="text-slate-500 hover:text-white text-xs flex items-center gap-1 transition-colors"
                        >
                            <Copy className="w-3 h-3" /> 프롬프트 복사
                        </button>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {/* AGENT DASHBOARD */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* Steps... (same as before) */}
        {/* Step 1 */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-emerald-500/30 opacity-70">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <PenTool className="w-5 h-5" />
            <span className="font-bold">1. 작가 (Writer)</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden mt-4">
            <div className="h-full bg-emerald-500 w-full"></div>
          </div>
        </div>

        {/* Step 2 */}
        <div className={`p-4 rounded-xl border transition-all ${activeAgent === 'Director' ? 'bg-blue-900/20 border-blue-500 ring-1 ring-blue-500' : 'bg-slate-800/50 border-slate-700'}`}>
          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center gap-2 text-blue-400">
                <Clapperboard className="w-5 h-5" />
                <span className="font-bold">2. 연출 (Director)</span>
             </div>
             <span className="text-xs font-mono text-slate-400">{stats.prompts}/{stats.total}</span>
          </div>
          <button 
            onClick={runDirectorAgent}
            disabled={!!activeAgent || stats.prompts === stats.total}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-slate-700 rounded-lg text-xs text-white font-bold transition-colors"
          >
            {activeAgent === 'Director' ? '기획 중...' : '프롬프트 생성'}
          </button>
        </div>

        {/* Step 3 */}
        <div className={`p-4 rounded-xl border transition-all ${activeAgent === 'Artist' ? 'bg-purple-900/20 border-purple-500 ring-1 ring-purple-500' : 'bg-slate-800/50 border-slate-700'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-purple-400">
                <ImageIcon className="w-5 h-5" />
                <span className="font-bold">3. 화가 (Artist)</span>
            </div>
            <span className="text-xs font-mono text-slate-400">{stats.images}/{stats.total}</span>
          </div>
          <button 
            onClick={runArtistAgent}
            disabled={!!activeAgent || stats.prompts === 0}
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:bg-slate-700 rounded-lg text-xs text-white font-bold transition-colors"
          >
            {activeAgent === 'Artist' ? '그리는 중...' : '이미지 생성'}
          </button>
        </div>

        {/* Step 4 */}
        <div className={`p-4 rounded-xl border transition-all ${activeAgent === 'Voice' ? 'bg-amber-900/20 border-amber-500 ring-1 ring-amber-500' : 'bg-slate-800/50 border-slate-700'}`}>
           <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-amber-400">
                    <Mic className="w-5 h-5" />
                    <span className="font-bold">4. 성우 (Voice)</span>
                </div>
                <span className="text-xs font-mono text-slate-400">{stats.audio}/{stats.total}</span>
           </div>
          <button 
             onClick={runVoiceAgent}
             disabled={!!activeAgent}
             className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:bg-slate-700 rounded-lg text-xs text-white font-bold transition-colors"
          >
            {activeAgent === 'Voice' ? '녹음 중...' : '음성 생성'}
          </button>
        </div>
      </div>

      {/* Scene List */}
      <div className="space-y-6">
        {scenes.map((scene) => (
          <div key={scene.scene_index} className="relative group">
            
            {/* ... Visual Preview (Same as before) ... */}
             {scene.assets.visual_url && (
                <div className="mb-2 rounded-xl overflow-hidden border border-slate-700 bg-black relative max-h-[400px]">
                    <img src={scene.assets.visual_url} alt="Generated" className="w-full h-full object-contain mx-auto" />
                    <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-xs text-white font-mono">
                        생성 완료
                    </div>
                </div>
            )}

            {/* Overlay for processing */}
            {scene.isProcessing && (
              <div className="absolute inset-0 bg-slate-900/80 z-20 rounded-xl flex items-center justify-center border border-blue-500/50 backdrop-blur-sm">
                 <div className="text-blue-400 font-mono animate-pulse flex flex-col items-center gap-2">
                   <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                   <span>AI 생성 중...</span>
                 </div>
              </div>
            )}
            
            <SceneCard 
              scene={scene}
              onToggleSelection={handleToggleSelection}
              onGenerateVideo={handleGenerateVideo}
            />

            {/* CUTS DISPLAY IN SCRIPTVIEW (NEW) */}
             {scene.cuts && scene.cuts.length > 0 && (
                 <div className="mx-4 mt-[-1px] bg-slate-900 border-x border-slate-800 p-4 relative z-0">
                     <div className="flex items-center gap-2 mb-3">
                         <LayoutTemplate className="w-4 h-4 text-purple-400" />
                         <span className="text-xs font-bold text-slate-400 uppercase">분할된 컷 (4개)</span>
                         <div className="h-px bg-slate-800 flex-1"></div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {scene.cuts.map(cut => (
                             <div key={cut.cut_no} className="bg-slate-950 p-3 rounded border border-slate-800/50 flex flex-col gap-2">
                                 <div className="flex justify-between items-start">
                                     <span className="bg-purple-900/30 text-purple-400 text-[10px] px-1.5 py-0.5 rounded border border-purple-800">
                                         Cut #{cut.cut_no}
                                     </span>
                                     <span className="text-[10px] text-slate-500 italic max-w-[70%] truncate">
                                         {cut.visual_detail}
                                     </span>
                                 </div>
                                 <p className="text-xs text-slate-300">
                                     {cut.narration}
                                 </p>
                             </div>
                         ))}
                     </div>
                 </div>
             )}

            {/* Asset Status Bar (Bottom) */}
            <div className={`mx-4 p-3 bg-slate-900 border-x border-b border-slate-800 rounded-b-xl flex items-center justify-between text-xs ${scene.cuts?.length ? 'mt-0' : 'mt-[-10px]'}`}>
                 <div className="flex items-center gap-4">
                     {scene.assets.visual_url ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                            <ImageIcon className="w-4 h-4" />
                            <span className="font-bold">이미지 준비됨</span>
                        </div>
                     ) : (
                        <div className="flex items-center gap-2 text-slate-600">
                            <ImageIcon className="w-4 h-4" />
                            <span>대기중</span>
                        </div>
                     )}
                     
                     {scene.assets.audio_url ? (
                        <div className="flex items-center gap-2 text-amber-400">
                            <Mic className="w-4 h-4" />
                            <span className="font-bold">오디오 준비됨</span>
                            <audio src={scene.assets.audio_url} controls className="h-6 w-32 opacity-80" />
                        </div>
                     ) : (
                        <div className="flex items-center gap-2 text-slate-600">
                            <Mic className="w-4 h-4" />
                            <span>대기중</span>
                        </div>
                     )}
                 </div>
                 
                 <div className="text-slate-500 font-mono">
                    ID: {scene.assets.base_id}
                 </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScriptView;