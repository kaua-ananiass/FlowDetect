import {ThinkingOrb} from '@/components/ui/thinking-orbs';
export default function ThinkingOrbSolvingDemo() {
  return <div className="flex min-h-[360px] w-full items-center justify-center bg-[#070707] p-8">
    <div className="inline-flex h-[74px] items-center gap-3 rounded-full pl-[9px] pr-8" style={{background:'rgba(29,29,29,0.42)',boxShadow:'inset 0 0 0 1px rgba(44,47,54,0.31), inset 0 0 50px 0 rgba(255,255,255,0.012)'}}>
      <span className="[&_canvas]:!size-14"><ThinkingOrb state="solving" size={64} theme="dark"/></span>
      <span className="whitespace-nowrap text-lg leading-6" style={{color:'rgba(251,251,251,0.5)'}}>Solving…</span>
    </div>
  </div>;
}
