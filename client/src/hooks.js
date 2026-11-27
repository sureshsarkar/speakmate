import { useCallback, useEffect, useRef, useState } from 'react';
import { useCallStore } from './store/callStore';

/** Loads data on mount / when deps change. */
export function useFetch(fn, deps = [], { interval } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (alive.current) setState({ data, loading: false, error: null });
    } catch (error) {
      if (alive.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error }));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    let timer;
    if (interval) timer = setInterval(() => load(true), interval);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: () => load(true), setData: (updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })) };
}

/** Seconds elapsed in the current call (ticks every second while in a call). */
export function useCallSeconds() {
  const base = useCallStore((s) => s.elapsedBase);
  const startedAt = useCallStore((s) => s.startedAtLocal);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? Math.floor(base + (Date.now() - startedAt) / 1000) : 0;
}

/** Seconds since `since` (ms epoch). */
export function useSecondsSince(since) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!since) return undefined;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [since]);
  return since ? Math.floor((Date.now() - since) / 1000) : 0;
}

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
