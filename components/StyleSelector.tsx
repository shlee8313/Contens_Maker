import React, { useState } from 'react';
import { FileText, Clock, Scissors, PlusCircle, Loader2 } from 'lucide-react';
import { ScriptData } from '../types';

interface StyleSelectorProps {
  scriptData: ScriptData;
  onSelectStyle: (styleName: string, stylePrompt: string) => void;
  onRewriteScript: (mode: 'longer' | 'shorter') => Promise<void>;
}

export const ART_STYLES = [
  {
    id: 'documentary',
    label: '🎬 시네마틱 다큐',
    desc: '영화 같은 조명, 4K 실사 텍스처, 웅장한 분위기',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80',
    prompt: "High-end National Geographic documentary style, 8k resolution, highly detailed, cinematic lighting, photorealistic, sharp focus"
  },
  {
    id: 'cyberpunk',
    label: '🎨 재패니메이션',
    desc: '지브리/신카이 마코토 스타일, 청량한 색감, 2D 셀화',
    image: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80',
    prompt: "Japanese anime style, Makoto Shinkai inspired, vibrant colors, detailed background art, lens flare, 2D cel shaded, cinematic composition"
  },
  {
    id: 'infographic',
    label: '🧊 3D 아이소메트릭',
    desc: '블렌더 3D 렌더링, 깔끔한 인포그래픽, 미니멀리즘',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    prompt: "Modern 3D isometric infographic style, clean minimalist design, vibrant colors, soft lighting, abstract data visualization, vector art style"
  },
  {
    id: 'history_painting',
    label: '🖼️ 유화 (Impressionism)',
    desc: '반 고흐 스타일, 두꺼운 붓터치, 예술적인 질감',
    image: 'https://images.unsplash.com/photo-1579783902614-a3fb39279c15?auto=format&fit=crop&w=800&q=80',
    prompt: "Classic oil painting style, textured canvas, epic scale, dramatic composition, reminiscent of 19th-century masterpieces, rich earth tones"
  },
  {
    id: 'stick_figure',
    label: '✏️ 흑백 스케치',
    desc: '연필 드로잉, 러프한 스케치, 누아르 분위기',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=800&q=80',
    prompt: "Hand-drawn pencil sketch style, rough lines, black and white, artistic shading, minimalist but detailed, blueprint aesthetic"
  },
  {
    id: 'mystery',
    label: '🕵️‍♂️ 미스터리/스릴러',
    desc: '어둡고 대비가 강한 긴장감 넘치는 분위기',
    image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80',
    prompt: "High contrast mystery style, dramatic shadows, volumetric fog, moody atmosphere, cinematic thriller lighting, muted colors, intense realism"
  },
  {
    id: 'war_gritty',
    label: '🪖 전쟁/종군기자',
    desc: '거친 보도사진 스타일, 필름 그레인',
    image: 'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?auto=format&fit=crop&w=800&q=80',
    prompt: "Gritty war photography style, grain texture, desaturated colors, intense action, handheld camera feel, emotional and raw"
  },
  {
    id: 'surreal',
    label: '🧠 초현실/심리',
    desc: '꿈속 같은 몽환적이고 기이한 상징성',
    image: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&w=800&q=80',
    prompt: "Surrealism art style, dreamlike atmosphere, abstract symbolism, distorted reality, psychological metaphor, Salvador Dali inspired"
  }
];

const StyleSelector: React.FC<StyleSelectorProps> = ({ scriptData, onSelectStyle, onRewriteScript }) => {
  const [isRewriting, setIsRewriting] = useState<'longer' | 'shorter' | null>(null);

  const totalChars = scriptData.scenes.reduce((acc, s) => acc + s.scripts.narration.length, 0);
  const estimatedDuration = Math.round(totalChars / 5); // Rough calc: 5 chars per sec

  const handleRewrite = async (mode: 'longer' | 'shorter') => {
      if (isRewriting) return;
      setIsRewriting(mode);
      try {
          await onRewriteScript(mode);
      } catch (e) {
          alert("재작성 중 오류가 발생했습니다.");
      } finally {
          setIsRewriting(null);
      }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 flex flex-col items-center animate-in fade-in duration-500 pb-20">
      
      {/* Header with Title */}
      <div className="text-center mb-10 w-full max-w-4xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">
           <FileText className="w-3 h-3" />
           Current Project
        </div>
        
        <h1 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight drop-shadow-2xl">
           {scriptData.meta.title}
        </h1>

        <div className="flex flex-col items-center gap-2">
             <h2 className="text-xl font-bold text-slate-300">
               비주얼 스타일 선택
             </h2>
             <p className="text-slate-500 max-w-xl mx-auto text-sm">
               영상의 분위기를 결정해주세요. 선택한 스타일에 맞춰 <strong className="text-emerald-400">AI Artist</strong>가 이미지를 생성합니다.
             </p>
        </div>
      </div>

      {/* Script Stats & Rewrite Controls */}
      <div className="w-full mb-12 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
              <div className="flex flex-col">
                  <span className="text-slate-400 text-xs font-bold uppercase mb-1">현재 원고 분량</span>
                  <div className="flex items-center gap-2 text-2xl font-bold text-white">
                      <FileText className="w-6 h-6 text-blue-400" />
                      {totalChars.toLocaleString()}자
                  </div>
              </div>
              <div className="w-px h-10 bg-slate-700 hidden md:block"></div>
              <div className="flex flex-col">
                  <span className="text-slate-400 text-xs font-bold uppercase mb-1">예상 러닝타임</span>
                  <div className="flex items-center gap-2 text-2xl font-bold text-white">
                      <Clock className="w-6 h-6 text-emerald-400" />
                      약 {Math.floor(estimatedDuration / 60)}분 {estimatedDuration % 60}초
                  </div>
              </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
              <button 
                  onClick={() => handleRewrite('longer')}
                  disabled={!!isRewriting}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-indigo-900/20"
              >
                  {isRewriting === 'longer' ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                  {isRewriting === 'longer' ? '작성 중...' : '길게 다시 쓰기'}
              </button>
              
              <button 
                  onClick={() => handleRewrite('shorter')}
                  disabled={!!isRewriting}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-xl font-bold transition-all hover:scale-105"
              >
                  {isRewriting === 'shorter' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                  {isRewriting === 'shorter' ? '줄이는 중...' : '짧게 요약하기'}
              </button>
          </div>
      </div>

      {/* NEW: Image-based Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-12">
        {ART_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => onSelectStyle(style.label, style.prompt)}
              className="group relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-transparent hover:border-emerald-500 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300 ring-offset-2 ring-offset-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {/* Background Image */}
              <img 
                src={style.image} 
                alt={style.label} 
                className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
              />
              
              {/* Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-300"></div>

              {/* Content */}
              <div className="absolute inset-0 p-5 flex flex-col justify-end text-left">
                 <h3 className="text-xl md:text-2xl font-black text-white mb-1 drop-shadow-lg group-hover:text-emerald-400 transition-colors">
                    {style.label}
                 </h3>
                 <p className="text-xs text-slate-300 line-clamp-2 font-medium opacity-80 group-hover:opacity-100 transition-opacity">
                    {style.desc}
                 </p>
              </div>
            </button>
        ))}
      </div>

      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 max-w-2xl w-full text-center">
         <h4 className="text-slate-500 text-xs font-bold uppercase mb-2">
            현재 대본 미리보기 (첫 문단)
         </h4>
         <p className="text-slate-200 italic font-medium leading-relaxed">
            "{scriptData.scenes[0]?.scripts.narration.substring(0, 100)}..."
         </p>
      </div>
    </div>
  );
};

export default StyleSelector;