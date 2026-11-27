import { useState } from 'react';
import { initials } from '../lib/format';
import { cx } from './ui';

const PALETTE = [
  ['#7ED957', '#2E8B3D'],
  ['#9BE15D', '#3F9A4A'],
  ['#63CC7A', '#1B5E20'],
  ['#B6E86B', '#4C9A2A'],
  ['#5EC9A0', '#1D7A57'],
  ['#8ADB6C', '#2F7D32'],
];

const pick = (name = '') => PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];

/** Profile picture with an initials fallback. `speaking` adds a pulsing ring. */
export default function Avatar({ src, name = '?', size = 48, speaking = false, className = '', online }) {
  const [failed, setFailed] = useState(false);
  const [a, b] = pick(name);
  const showImg = src && !failed;
  return (
    <div className={cx('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className={cx(
          'flex h-full w-full items-center justify-center overflow-hidden rounded-full font-extrabold text-white transition-shadow',
          speaking && 'animate-ring'
        )}
        style={{ background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: size * 0.36 }}
      >
        {showImg ? (
          <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} referrerPolicy="no-referrer" draggable={false} />
        ) : (
          initials(name)
        )}
      </div>
      {online !== undefined && (
        <span
          className={cx(
            'absolute bottom-0 right-0 rounded-full border-2 border-white',
            online === 'online' ? 'bg-emerald-500' : online === 'busy' ? 'bg-amber-400' : 'bg-ink/25'
          )}
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
        />
      )}
    </div>
  );
}
