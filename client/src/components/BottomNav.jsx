import { NavLink, useLocation } from 'react-router-dom';
import { Heart, History, Home, Mic, UserRound } from 'lucide-react';
import { cx } from './ui';

const ITEMS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/practice', label: 'Practice', icon: Mic },
  { to: '/history', label: 'History', icon: History },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 border-t border-secondary/10 bg-white/90 px-2 pb-safe backdrop-blur-xl"
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch justify-between">
        {ITEMS.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <li key={to} className="flex-1">
              <NavLink to={to} className="group flex flex-col items-center gap-0.5 py-2.5" aria-current={active ? 'page' : undefined}>
                <span
                  className={cx(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300',
                    active ? 'bg-primary text-secondary shadow-glow' : 'text-ink/45 group-hover:text-secondary'
                  )}
                >
                  <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.6 : 2.1} />
                </span>
                <span className={cx('text-[11px] font-bold', active ? 'text-secondary' : 'text-ink/45')}>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
