import React, { useState, useEffect, useRef } from 'react';
import { ScriptData, Scene, LayoutType } from '../types';
import { loadProject, executeAssetGeneration } from '../services/pipeline';
import { 
  Play, Pause, Download, ArrowLeft, Save, 
  Image as ImageIcon, Mic, Eye, CheckCircle2, 
  AlertTriangle, RefreshCw, LayoutTemplate, Check
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
  // This satisfies the requirement "Start image generation immediately when complete".
  useEffect(() => {
      const hasGeneratedAssets = initialData.scenes.some(s => s.progress_status.is_image_generated);
      if (!hasGeneratedAssets && !resumeCandidate) {
          // Small timeout to allow render
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

  // --- ZIP DOWNLOAD LOGIC ---
  const handleDownloadZip = async () => {
    setDownloadStatus('압축 중...');
    const zip = new JSZip();
    const assetsFolder = zip.folder("assets");

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
        assets: cleanAssets
      };
    });

    const manifest = {
      ...project,
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
  const imagesDone = project.scenes.filter(s => s.progress_status.is_image_generated).length;
  const audioDone = project.scenes.filter(s => s.progress_status.is_audio_generated).length;
  const progressPercent = Math.round(((imagesDone + audioDone) / (totalScenes * 2)) * 100);
  const isComplete = progressPercent === 100;

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
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isComplete ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-blue-500 to-purple-500'}`}
              style={{ width: `${progressPercent}%` }}
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
        {project.scenes.map((scene) => (
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
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2 py-1 rounded text-[10px] text-green-400 font-mono border border-green-900/50 flex items-center gap-1">
                    <LayoutTemplate className="w-3 h-3" />
                    {scene.inspection_data.detected_layout}
                  </div>
                )}
              </div>

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
                
                <p className="text-sm text-slate-200 leading-relaxed font-medium mb-3">
                  {scene.scripts.narration}
                </p>
                
                <div className="bg-slate-950/30 p-2 rounded border border-slate-800/50">
                  <p className="text-xs text-slate-400 font-mono line-clamp-2">
                    Prompt: {scene.prompts.visual_prompt}
                  </p>
                </div>
              </div>

              {/* Footer Meta */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/50">
                <div className="flex items-center gap-3">
                   {scene.assets.audio_url && (
                     /* IMPORTANT: Added key prop to force re-render when audio url changes */
                     <audio 
                       key={scene.assets.audio_url}
                       src={scene.assets.audio_url} 
                       controls 
                       className="h-6 w-48 opacity-70 scale-90 origin-left" 
                     />
                   )}
                </div>
                <div className="text-xs text-slate-600 font-mono">
                  ID: {scene.assets.base_id}
                </div>
              </div>
            </div>
          </div>
        ))}
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