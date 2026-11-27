import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';

/** Main tabbed layout: centred "phone" column on desktop, full-bleed on mobile. */
export default function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.body.classList.add('app-frame');
    return () => document.body.classList.remove('app-frame');
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-light md:shadow-[0_0_90px_-25px_rgb(27_94_32/0.45)]">
      <main className="pt-safe">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
