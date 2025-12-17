import React from 'react';
import { Scene } from '../types';
import { Film, Image as ImageIcon, Wand2, CheckCircle2, Copy, FileText } from 'lucide-react';

interface SceneCardProps {
  scene: Scene;
  onToggleSelection: (index: number) => void;
  onGenerateVideo: (index: number) => void;
}

const VOICE_TONE_MAP: Record<string, string> = {
  excited: '격정적',
  serious: '진지함',
  calm: '차분함',
  whisper: '속삭임',
};

const SceneCard: React.FC<SceneCardProps> = ({ scene, onToggleSelection, onGenerateVideo }) => {
  const isVideo = scene.type === 'video';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Optional: Add toast notification logic here
  };

  return (
    <div className={`
      relative p-5 rounded-xl border transition-all duration-300
      ${scene.isSelected 
        ? 'bg-slate-800 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.1)]' 
        : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'}
    `}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-700 text-sm font-bold text-slate-300">
            {scene.scene_index}
          </div>
          <div>
            <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              {scene.step_phase}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {isVideo ? (
                <span className="flex items-center text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded">
                  <Film className="w-3 h-3 mr-1" /> 비디오 ({scene.duration_prediction}초)
                </span>
              ) : (
                <span className="flex items-center text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                  <ImageIcon className="w-3 h-3 mr-1" /> 이미지 ({scene.duration_prediction}초)
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => onToggleSelection(scene.scene_index)}
          className={`
            w-6 h-6 rounded-full border flex items-center justify-center transition-all
            ${scene.isSelected 
              ? 'bg-blue-500 border-blue-500 text-white' 
              : 'border-slate-600 text-transparent hover:border-slate-400'}
          `}
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Script Section */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">내레이션 ({VOICE_TONE_MAP[scene.scripts.voice_tone] || scene.scripts.voice_tone})</h4>
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              "{scene.scripts.narration}"
            </p>
            <div className="mt-3 pt-3 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 mb-1 uppercase">자막 (Subtitles)</h4>
              <div className="flex flex-wrap gap-2">
                {scene.scripts.subtitles && scene.scripts.subtitles.length > 0 ? (
                    scene.scripts.subtitles.map((sub, idx) => (
                        <span key={idx} className="text-sm text-yellow-400/90 font-medium bg-black/40 px-2 py-1 rounded">
                            {sub}
                        </span>
                    ))
                ) : (
                    <span className="text-xs text-slate-600">자막 없음</span>
                )}
              </div>
            </div>
          </div>

          {/* File ID Display - Critical for File Management */}
          <div className="mt-4 p-2 bg-slate-950/50 rounded border border-slate-800 flex items-center justify-between group">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <FileText className="w-3 h-3" />
              <span className="truncate max-w-[200px]">{scene.assets.base_id}</span>
            </div>
            <button 
              onClick={() => copyToClipboard(scene.assets.base_id)}
              className="text-slate-600 hover:text-blue-400 transition-colors"
              title="파일 ID 복사"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Visual Prompt Section */}
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">시각 프롬프트 (영어)</h4>
            <p className="text-xs text-slate-400 font-mono leading-relaxed break-words bg-slate-950 p-2 rounded border border-slate-800">
              {scene.prompts.visual_prompt}
            </p>
          </div>
          
          <div className="mt-4 flex justify-between items-center">
             <div className="text-xs text-slate-500">
                모션 강도: {isVideo ? scene.prompts.motion_strength : 0}/10
             </div>

             {!isVideo && (
               <button 
                 onClick={() => onGenerateVideo(scene.scene_index)}
                 disabled={scene.isGeneratingVideo}
                 className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
               >
                 {scene.isGeneratingVideo ? (
                    <>생성 중...</>
                 ) : (
                    <>
                      <Wand2 className="w-3 h-3" />
                      비디오 생성
                    </>
                 )}
               </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SceneCard;