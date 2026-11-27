import { useAppStore } from '../store/appStore';

export function LogoMark({ size = 40 }) {
  const logoUrl = useAppStore((s) => s.config?.logoUrl);
  if (logoUrl) return <img src={logoUrl} alt="" style={{ width: size, height: size }} className="rounded-xl object-cover" />;
  const bars = [0.34, 0.58, 0.82, 0.58, 0.34];
  return (
    <div
      className="flex items-center justify-center gap-[3px] rounded-[28%] shadow-glow"
      style={{ width: size, height: size, background: 'linear-gradient(135deg, rgb(var(--c-primary)), rgb(var(--c-primary) / .78))' }}
    >
      {bars.map((b, i) => (
        <i key={i} className="block rounded-full bg-secondary" style={{ width: size * 0.085, height: size * b * 0.62 }} />
      ))}
    </div>
  );
}

export default function Logo({ size = 40, text = true, className = '' }) {
  const name = useAppStore((s) => s.config?.appName) || 'SpeakMate';
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {text && <span className="text-xl font-extrabold tracking-tight text-secondary">{name}</span>}
    </div>
  );
}
