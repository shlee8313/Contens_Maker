import React, { useState, useEffect, useRef } from 'react';
import { ScriptData, Scene, LayoutType } from '../types';
import { loadProject, executeAssetGeneration, saveToIndexedDB } from '../services/pipeline';
import { generateImage, generateSpeech, inspectImage } from '../services/geminiService';
import { 
  Play, Pause, Download, ArrowLeft, Save, 
  Image as ImageIcon, Mic, Eye, CheckCircle2, 
  AlertTriangle, RefreshCw, LayoutTemplate, Check,
  Edit3, X, RotateCw, Wand2, Film, ChevronDown, ChevronUp
} from 'lucide-react';
// @ts-ignore
import JSZip from 'jszip';

// Helper for file download
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

interface DashboardProps {
  initialData: ScriptData;
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ initialData, onBack }) => {
  const [project, setProject] = useState<ScriptData>(initialData);
  const [resumeCandidate, setResumeCandidate] = useState<ScriptData | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string>('');
  const stopSignalRef = useRef({ stopped: false });

  // [NEW] State for individual regeneration and editing
  const [regeneratingScenes, setRegeneratingScenes] = useState<Set<number>>(new Set());
  const [editingScene, setEditingScene] = useState<number | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [expandedNarration, setExpandedNarration] = useState<Set<number>>(new Set());

  // 1. Resume Capability: Check DB on mount
  useEffect(() => {
    const checkSavedProject = async () => {
      const saved = await loadProject();
      if (saved) {
        // Simple check: if saved timestamp is newer than initial (if exists) or just exists
        if (saved.meta.title !== initialData.meta.title || saved.meta.timestamp !== initialData.meta.timestamp) {
           setResumeCandidate(saved);
        }
      }
    };
    checkSavedProject();
  }, [initialData]);

  // Handle Pipeline Execution
  const startPipeline = async () => {
      stopSignalRef.current.stopped = false;
      setIsRunning(true);
      
      try {
        await executeAssetGeneration(
          project,
          (updated) => setProject(updated), // Live updates
          stopSignalRef.current
        );
      } catch (e) {
        console.error("Pipeline Error", e);
        alert("오류로 인해 작업이 중지되었습니다.");
      } finally {
        setIsRunning(false);
      }
  };

  const togglePipeline = async () => {
    if (isRunning) {
      // STOP
      stopSignalRef.current.stopped = true;
      setIsRunning(false);
    } else {
      // START
      await startPipeline();
    }
  };

  // Auto-start pipeline if it's a fresh project (no images generated yet)
  useEffect(() => {
      const hasGeneratedAssets = initialData.scenes.some(s => s.progress_status.is_image_generated);
      if (!hasGeneratedAssets && !resumeCandidate) {
          const timer = setTimeout(() => {
              if (!isRunning) startPipeline();
          }, 500);
          return () => clearTimeout(timer);
      }
  }, []);

  const handleResumeConfirm = () => {
    if (resumeCandidate) {
      setProject(resumeCandidate);
      setResumeCandidate(null);
    }
  };

  const handleEmergencyExport = () => {
    const jsonString = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${project.meta.title}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- INDIVIDUAL REGENERATION LOGIC ---

  const regenerateSceneImage = async (index: number, customPrompt?: string) => {
    if (isRunning) {
        alert("전체 파이프라인이 실행 중일 때는 개별 작업을 할 수 없습니다. 일시정지 후 시도해주세요.");
        return;
    }

    setRegeneratingScenes(prev => new Set(prev).add(index));
    
    try {
        const scene = project.scenes.find(s => s.scene_index === index);
        if (!scene) return;

        // Use custom prompt if provided (from edit mode), otherwise use existing
        const promptToUse = customPrompt || scene.prompts.visual_prompt;
        const url = await generateImage(promptToUse, scene.planned_layout);

        if (url) {
            setProject(prev => {
                const newScenes = prev.scenes.map(s => s.scene_index === index ? {
                    ...s,
                    assets: { ...s.assets, visual_url: url },
                    progress_status: { 
                        ...s.progress_status, 
                        is_image_generated: true, 
                        is_image_inspected: false // Mark for re-inspection
                    }
                } : s);
                
                const newData = { ...prev, scenes: newScenes };
                saveToIndexedDB(newData);
                return newData;
            });
        }
    } catch (e: any) {
        console.error(e);
        const msg = e.message || e.toString();
        if (msg.includes("quota") || msg.includes("할당량")) {
            alert("⚠️ API 할당량을 초과했습니다. 잠시 후 다시 시도해주세요.");
        } else {
            alert("이미지 재생성 실패: " + msg);
        }
    } finally {
        setRegeneratingScenes(prev => {
            const next = new Set(prev);
            next.delete(index);
            return next;
        });
    }
  };

  const regenerateSceneAudio = async (index: number) => {
      if (isRunning) {
          alert("전체 파이프라인이 실행 중일 때는 개별 작업을 할 수 없습니다.");
          return;
      }

      setRegeneratingScenes(prev => new Set(prev).add(index));

      try {
          const scene = project.scenes.find(s => s.scene_index === index);
          if (!scene) return;

          const textToRead = scene.scripts.tts_text || scene.narration_full || scene.scripts.narration;
          const url = await generateSpeech(textToRead, scene.scripts.voice_tone);

          if (url) {
              setProject(prev => {
                  const newScenes = prev.scenes.map(s => s.scene_index === index ? {
                      ...s,
                      assets: { ...s.assets, audio_url: url },
                      progress_status: { ...s.progress_status, is_audio_generated: true }
                  } : s);
                  
                  const newData = { ...prev, scenes: newScenes };
                  saveToIndexedDB(newData);
                  return newData;
              });
          }
      } catch (e: any) {
          console.error(e);
          alert("오디오 재생성 실패: " + (e.message || "알 수 없는 오류"));
      } finally {
          setRegeneratingScenes(prev => {
              const next = new Set(prev);
              next.delete(index);
              return next;
          });
      }
  };

  // --- PROMPT EDITING LOGIC ---

  const startEditPrompt = (index: number, currentPrompt: string) => {
      if (isRunning) return;
      setEditingScene(index);
      setEditedPrompt(currentPrompt);
  };

  const cancelEditPrompt = () => {
      setEditingScene(null);
      setEditedPrompt('');
  };

  const saveAndRegeneratePrompt = async (index: number) => {
      if (!editedPrompt.trim()) return;

      // 1. Update project state first with new prompt
      setProject(prev => {
          const newScenes = prev.scenes.map(s => s.scene_index === index ? {
              ...s,
              prompts: { ...s.prompts, visual_prompt: editedPrompt }
          } : s);
          return { ...prev, scenes: newScenes };
      });

      // 2. Exit edit mode
      setEditingScene(null);

      // 3. Trigger regeneration with new prompt
      await regenerateSceneImage(index, editedPrompt);
  };

  const toggleNarrationExpand = (index: number) => {
      setExpandedNarration(prev => {
          const next = new Set(prev);
          if (next.has(index)) next.delete(index);
          else next.add(index);
          return next;
      });
  };

  // --- ZIP DOWNLOAD LOGIC ---
  const handleDownloadZip = async () => {
    setDownloadStatus('압축 중...');
    const zip = new JSZip();
    const assetsFolder = zip.folder("assets");

    if (project.meta.thumbnail_url && project.meta.thumbnail_url.startsWith('data:image')) {
        const thumbData = project.meta.thumbnail_url.split(',')[1];
        zip.file("thumbnail.png", thumbData, {base64: true});
    }

    const manifestScenes = project.scenes.map(s => {
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
        assets: cleanAssets,
        // Include Cuts Info for video editor
        cuts: s.cuts,
        narration_full: s.narration_full
      };
    });

    const manifest = {
      ...project,
      meta: {
          ...project.meta,
          thumbnail_url: project.meta.thumbnail_url ? 'thumbnail.png' : undefined
      },
      scenes: manifestScenes
    };

    zip.file("project.json", JSON.stringify(manifest, null, 2));

    try {
      const content = await zip.generateAsync({type: "blob"});
      const safeTitle = project.meta.title.replace(/[^a-z0-9가-힣]/gi, '_').substring(0, 30);
      saveAs(content, `${safeTitle}_completed.zip`);
      setDownloadStatus('');
    } catch (e) {
      console.error(e);
      alert("ZIP 생성 중 오류가 발생했습니다.");
      setDownloadStatus('');
    }
  };

  // Calculate Stats
  const totalScenes = project.scenes.length;
  // Count video generation attempts (either successful video or fallback grid)
  const videoScenes = project.scenes.filter(s => s.type === 'video').length;
  const imagesDone = project.scenes.filter(s => s.progress_status.is_image_generated).length;
  const audioDone = project.scenes.filter(s => s.progress_status.is_audio_generated).length;
  
  // Total work = (Scenes * 2) + Video Scenes (as extra step)
  const totalWork = (totalScenes * 2) + videoScenes;
  
  // Completed work. Note: If it was video type, but fell back to grid, we count it as done if image is done.
  // Actually simplest is: Image + Audio + (Video Attempted ? 1 : 0)
  const videoAttempts = project.scenes.filter(s => s.type === 'video' && (s.progress_status.is_video_generated || s.planned_layout === 'GRID_2X2')).length;
  
  const progressPercent = Math.round(((imagesDone + audioDone + videoAttempts) / totalWork) * 100) || 0;
  const isComplete = progressPercent >= 100;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 pb-20">
      
      {/* RESUME MODAL */}
      {resumeCandidate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-600 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-blue-400" />
              작업 복구
            </h3>
            <p className="text-slate-300 mb-6">
              이전에 저장된 프로젝트 <strong>"{resumeCandidate.meta.title}"</strong>를 찾았습니다.
              <br/>불러오시겠습니까?
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setResumeCandidate(null)}
                className="px-4 py-2 text-slate-400 hover:text-white"
              >
                무시하기
              </button>
              <button 
                onClick={handleResumeConfirm}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold"
              >
                불러오기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP CONTROLS */}
      <div className="sticky top-4 z-40 bg-slate-900/90 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-lg mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full text-slate-400">
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          {/* Thumbnail Preview */}
          {project.meta.thumbnail_url ? (
              <div className="w-16 h-9 rounded bg-black overflow-hidden border border-slate-600">
                  <img src={project.meta.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
              </div>
          ) : (
              <div className="w-16 h-9 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-slate-600" />
              </div>
          )}

          <div>
            <h1 className="font-bold text-lg text-white truncate max-w-[200px] md:max-w-md">
              {project.meta.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
              {isRunning ? '자동 생성 중' : '대기'}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex-1 w-full md:mx-8">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>진행률</span>
            <span>{Math.min(progressPercent, 100)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isComplete ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {isComplete ? (
              <button
                onClick={handleDownloadZip}
                disabled={!!downloadStatus}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg bg-green-600 hover:bg-green-500 shadow-green-900/20 hover:scale-105 transition-all animate-in zoom-in"
              >
                {downloadStatus ? (
                    <> <RefreshCw className="w-4 h-4 animate-spin" /> {downloadStatus} </>
                ) : (
                    <> <Download className="w-4 h-4" /> 전체 다운로드 (.zip) </>
                )}
              </button>
          ) : (
              <button
                onClick={togglePipeline}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-lg transition-all
                  ${isRunning 
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20' 
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20 hover:scale-105'
                  }`}
              >
                {isRunning ? (
                  <> <Pause className="w-4 h-4" /> 일시정지 </>
                ) : (
                  <> <Play className="w-4 h-4" /> {progressPercent > 0 ? '이어서 하기' : '생성 시작'} </>
                )}
              </button>
          )}
          
          <button
            onClick={handleEmergencyExport}
            className="p-2.5 bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-lg text-slate-300"
            title="Emergency Export (JSON)"
          >
            <Save className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* TIMELINE GRID */}
      <div className="grid grid-cols-1 gap-4">
        {project.scenes.map((scene) => {
          const isRegenerating = regeneratingScenes.has(scene.scene_index);
          const isEditing = editingScene === scene.scene_index;
          const isCutView = scene.cuts && scene.cuts.length > 0;
          const isExpanded = expandedNarration.has(scene.scene_index);
          
          return (
            <div 
              key={scene.scene_index} 
              className={`
                relative flex flex-col md:flex-row gap-4 p-4 rounded-xl border transition-all
                ${(scene.progress_status.is_image_generated && scene.progress_status.is_audio_generated)
                  ? 'bg-slate-900/50 border-slate-800'
                  : 'bg-slate-800 border-slate-700'
                }
                ${scene.progress_status.is_image_generated ? '' : 'opacity-90'}
              `}
            >
              {/* Left: Thumbnail & Visual Status */}
              <div className="w-full md:w-64 flex-shrink-0 flex flex-col gap-2">
                <div className="relative aspect-video bg-black rounded-lg border border-slate-700 overflow-hidden group">
                  {scene.assets.visual_url ? (
                    <img src={scene.assets.visual_url} alt="Scene Asset" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-700">
                      <ImageIcon className="w-8 h-8 opacity-20" />
                    </div>
                  )}
                  
                  {/* Inspection Overlay */}
                  {scene.inspection_data && (
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-[10px] text-green-400 font-mono border border-green-900/50 flex items-center gap-1 z-10">
                      <LayoutTemplate className="w-3 h-3" />
                      {scene.inspection_data.detected_layout}
                    </div>
                  )}

                  {/* Loading Overlay */}
                  {isRegenerating && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-blue-400 z-20 backdrop-blur-sm">
                        <RefreshCw className="w-8 h-8 animate-spin mb-2" />
                        <span className="text-xs font-bold animate-pulse">생성 중...</span>
                    </div>
                  )}
                </div>

                {/* Left Action Button (Regen Image) */}
                <button
                   onClick={() => regenerateSceneImage(scene.scene_index)}
                   disabled={isRunning || isRegenerating}
                   className="w-full py-1.5 flex items-center justify-center gap-2 bg-slate-800 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400 border border-slate-700 hover:border-blue-500/50 rounded transition-all text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                    이미지 재생성
                </button>

                <div className="grid grid-cols-3 gap-1">
                  <StatusBadge 
                    active={scene.progress_status.is_image_generated} 
                    icon={ImageIcon} 
                    label="IMG" 
                  />
                  <StatusBadge 
                    active={scene.progress_status.is_image_inspected || false} 
                    icon={Eye} 
                    label="VIS" 
                  />
                  <StatusBadge 
                    active={scene.progress_status.is_audio_generated} 
                    icon={Mic} 
                    label="TTS" 
                  />
                </div>
                
                {/* [NEW] Video / Grid Badge */}
                {scene.type === 'video' && (
                    <div className={`mt-1 flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold border 
                        ${scene.progress_status.is_video_generated 
                            ? 'bg-purple-900/30 text-purple-400 border-purple-800' 
                            : 'bg-indigo-900/30 text-indigo-400 border-indigo-800'}`}>
                        {scene.progress_status.is_video_generated ? <Film className="w-3 h-3" /> : <LayoutTemplate className="w-3 h-3" />}
                        {scene.progress_status.is_video_generated ? 'VIDEO' : '2x2 CUTS'}
                    </div>
                )}
              </div>

              {/* Right: Content & Script */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded bg-slate-700 text-xs font-bold text-slate-300">
                      #{scene.scene_index}
                    </span>
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">
                      {scene.step_phase}
                    </span>
                    <span className="text-xs text-slate-500 ml-auto font-mono">
                      {scene.planned_layout}
                    </span>
                  </div>
                  
                  {/* [NEW] Cuts Display for Video/Grid Fallback */}
                  {isCutView ? (
                      <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                             <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                 <LayoutTemplate className="w-3 h-3" /> 내레이션 (4컷 분할)
                             </h4>
                             <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold border border-purple-500/30">
                                4 Cuts
                             </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                              {scene.cuts!.map((cut) => (
                                  <div key={cut.cut_no} className="bg-slate-950/50 p-3 rounded border border-slate-800/50">
                                      <div className="flex items-center gap-2 mb-1">
                                          <span className="w-5 h-5 rounded-full bg-purple-900/50 text-purple-300 text-[10px] font-bold flex items-center justify-center border border-purple-700">
                                              #{cut.cut_no}
                                          </span>
                                          <span className="text-[10px] text-slate-500 italic truncate max-w-[150px]">
                                              {cut.visual_detail}
                                          </span>
                                      </div>
                                      <p className="text-sm text-slate-200 leading-snug">
                                          "{cut.narration}"
                                      </p>
                                  </div>
                              ))}
                          </div>

                          <button 
                            onClick={() => toggleNarrationExpand(scene.scene_index)}
                            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
                            {isExpanded ? "전체 내레이션 접기" : "전체 내레이션 보기"}
                          </button>
                          
                          {isExpanded && (
                              <p className="mt-2 text-xs text-slate-400 bg-slate-900 p-2 rounded border border-slate-800/50">
                                  {scene.narration_full}
                              </p>
                          )}
                      </div>
                  ) : (
                      <p className="text-sm text-slate-200 leading-relaxed font-medium mb-3">
                        {scene.scripts.narration}
                      </p>
                  )}
                  
                  {/* PROMPT EDITOR */}
                  {isEditing ? (
                      <div className="bg-slate-900 border border-blue-500/50 rounded p-2 animate-in fade-in zoom-in duration-200">
                          <div className="flex items-center gap-2 mb-1.5 text-xs text-blue-400 font-bold">
                              <Wand2 className="w-3 h-3" /> 프롬프트 수정 모드
                          </div>
                          <textarea 
                             value={editedPrompt}
                             onChange={(e) => setEditedPrompt(e.target.value)}
                             className="w-full bg-slate-950 text-xs text-slate-200 p-2 rounded border border-slate-700 focus:border-blue-500 focus:outline-none h-20 resize-none"
                          />
                          <div className="flex gap-2 mt-2 justify-end">
                              <button 
                                onClick={cancelEditPrompt}
                                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                              >
                                취소
                              </button>
                              <button 
                                onClick={() => saveAndRegeneratePrompt(scene.scene_index)}
                                className="px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded flex items-center gap-1.5 transition-colors font-bold shadow-lg shadow-blue-900/20"
                              >
                                <Check className="w-3 h-3" /> 저장 후 재생성
                              </button>
                          </div>
                      </div>
                  ) : (
                      <div className="bg-slate-950/30 p-2 rounded border border-slate-800/50 group hover:border-slate-600 transition-colors relative">
                        <p className="text-xs text-slate-400 font-mono line-clamp-2 pr-6">
                          Prompt: {scene.prompts.visual_prompt}
                        </p>
                        <button 
                            onClick={() => startEditPrompt(scene.scene_index, scene.prompts.visual_prompt)}
                            disabled={isRunning}
                            className="absolute top-2 right-2 p-1 text-slate-500 hover:text-blue-400 bg-slate-900 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-all disabled:hidden"
                            title="프롬프트 수정"
                        >
                            <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                  )}
                </div>

                {/* Footer Meta & Actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/50">
                  <div className="flex items-center gap-3">
                     {scene.assets.audio_url ? (
                       <audio 
                         key={scene.assets.audio_url}
                         src={scene.assets.audio_url} 
                         controls 
                         className="h-6 w-48 opacity-70 scale-90 origin-left" 
                       />
                     ) : (
                        <span className="text-xs text-slate-600 italic">오디오 없음</span>
                     )}
                     
                     {/* Audio Regen Button */}
                     <button
                        onClick={() => regenerateSceneAudio(scene.scene_index)}
                        disabled={isRunning || isRegenerating}
                        className="p-1.5 bg-slate-800 hover:bg-purple-600/20 text-slate-400 hover:text-purple-400 rounded border border-slate-700 hover:border-purple-500/50 transition-all disabled:opacity-50"
                        title="오디오만 다시 생성"
                     >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                     </button>
                  </div>
                  <div className="text-xs text-slate-600 font-mono">
                    ID: {scene.assets.base_id}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatusBadge = ({ active, icon: Icon, label }: { active: boolean, icon: any, label: string }) => (
  <div className={`
    flex items-center justify-center gap-1 py-1 rounded text-[10px] font-bold border
    ${active 
      ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' 
      : 'bg-slate-800 text-slate-600 border-slate-700'
    }
  `}>
    <Icon className="w-3 h-3" />
    {label}
  </div>
);

export default Dashboard;