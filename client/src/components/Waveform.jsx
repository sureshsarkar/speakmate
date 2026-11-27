import { useEffect, useRef, useState } from 'react';

const VOICE_BINS = 24; // roughly 0-4.5 kHz at 48 kHz sample rate with fftSize 256

const tone = (name) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim() || '126 217 87';
  return `rgb(${v.split(/\s+/).join(',')})`;
};

/**
 * Live voice waveform from a Web Audio AnalyserNode.
 * With no analyser (or `active` false) it shows a calm idle line.
 */
export default function Waveform({ analyser, color = 'primary', bars = 30, height = 64, active = true, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const levels = new Array(bars).fill(0);
    const fill = tone(color);
    let raf;
    let t = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.06;
      ctx.clearRect(0, 0, w, h);
      if (data && active) analyser.getByteFrequencyData(data);
      const gap = Math.max(2, w / bars / 3.2);
      const bw = (w - gap * (bars - 1)) / bars;
      const mid = (bars - 1) / 2;
      ctx.fillStyle = fill;
      for (let i = 0; i < bars; i++) {
        const d = Math.abs(i - mid) / mid; // 0 at the centre, 1 at the edges
        let v = 0;
        if (data && active) {
          const idx = 1 + Math.min(VOICE_BINS - 1, Math.floor(d * (VOICE_BINS - 2)));
          v = (data[idx] / 255) * (1.25 - d * 0.35);
        }
        const idle = 2.5 + Math.sin(t + i * 0.6) * 1.2;
        const target = Math.max(idle, Math.min(1, v) * h * 0.96);
        levels[i] += (target - levels[i]) * 0.38;
        const bh = Math.max(3, levels[i]);
        const x = i * (bw + gap);
        const y = (h - bh) / 2;
        ctx.globalAlpha = 0.55 + Math.min(0.45, bh / h);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, bw, bh, bw / 2);
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [analyser, bars, color, active]);

  return <canvas ref={ref} className={className} style={{ width: '100%', height }} aria-hidden="true" />;
}

/** True while the analysed stream carries voice (with a short hang time to avoid flicker). */
export function useSpeaking(analyser, threshold = 0.1) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!analyser) {
      setSpeaking(false);
      return undefined;
    }
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf;
    let last = 0;
    let on = false;
    let offAt = 0;
    const tick = (ts) => {
      raf = requestAnimationFrame(tick);
      if (ts - last < 90) return;
      last = ts;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 1; i < VOICE_BINS; i++) sum += data[i];
      const avg = sum / (VOICE_BINS - 1) / 255;
      if (avg > threshold) {
        offAt = ts + 350;
        if (!on) {
          on = true;
          setSpeaking(true);
        }
      } else if (on && ts > offAt) {
        on = false;
        setSpeaking(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyser, threshold]);
  return speaking;
}
