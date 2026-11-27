import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { BookOpen, Mic, MicOff, PhoneOff, ShieldAlert, SkipForward, Volume2, VolumeX, WifiOff } from 'lucide-react';
import Avatar from '../components/Avatar';
import { ReportSheet } from '../components/Shared';
import { Badge, LevelBadge, Select, Sheet, Spinner, cx } from '../components/ui';
import Waveform, { useSpeaking } from '../components/Waveform';
import { useCallSeconds, useFetch } from '../hooks';
import { api } from '../lib/api';
import { engine } from '../lib/callEngine';
import { pathForPhase } from '../lib/constants';
import { formatClock } from '../lib/format';
import { useCallStore } from '../store/callStore';

const QUALITY = {
  unknown: { label: 'Checking', color: 'bg-white/40', bars: 1, text: 'text-white/70' },
  good: { label: 'Good', color: 'bg-primary', bars: 4, text: 'text-primary' },
  fair: { label: 'Fair', color: 'bg-amber-400', bars: 3, text: 'text-amber-300' },
  poor: { label: 'Poor', color: 'bg-red-400', bars: 2, text: 'text-red-300' },
};

function QualityIndicator({ quality, connection }) {
  const q = QUALITY[connection === 'reconnecting' ? 'poor' : quality] || QUALITY.unknown;
  return (
    <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5" title="Connection quality">
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <i key={i} className={cx('block w-1 rounded-sm', i <= q.bars ? q.color : 'bg-white/20')} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      <span className={cx('text-xs font-bold', q.text)}>{q.label}</span>
    </div>
  );
}

function ControlButton({ icon: Icon, label, onClick, active, danger, big, disabled, tone }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center gap-1.5 disabled:opacity-40"
      aria-label={label}
      aria-pressed={active}
    >
      <span
        className={cx(
          'flex items-center justify-center rounded-full transition active:scale-90',
          big ? 'h-[72px] w-[72px]' : 'h-14 w-14',
          danger ? 'bg-red-500 text-white shadow-[0_10px_30px_-6px_rgba(239,68,68,.7)]' : active ? 'bg-white text-secondary' : tone || 'bg-white/15 text-white group-hover:bg-white/25'
        )}
      >
        <Icon className={big ? 'h-8 w-8' : 'h-6 w-6'} />
      </span>
      <span className="text-[11px] font-bold text-white/80">{label}</span>
    </button>
  );
}

function AssistantSheet({ open, onClose, topic }) {
  const [tab, setTab] = useState('topic');
  const { data, loading } = useFetch(() => api.get('/content/assist', { params: { topic: topic?.slug } }).then((r) => r.data), [topic?.slug]);
  const tabs = [
    ['topic', 'Starters'],
    ['phrases', 'Sentences'],
    ['words', 'Vocabulary'],
  ];
  return (
    <Sheet open={open} onClose={onClose} title="English helper">
      <p className="-mt-2 mb-3 text-xs text-ink/50">For your eyes only. Use these ideas while you speak. It is not a chat.</p>
      <div className="mb-4 flex gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('chip flex-1 justify-center', tab === k && 'chip-active')}>
            {l}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-8 text-secondary">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-2">
          {tab === 'topic' && (
            <>
              {topic && (
                <p className="mb-1 text-sm font-bold text-secondary">
                  Topic: {data?.topic?.icon} {topic.title}
                </p>
              )}
              {[...(data?.topic?.starters || []), ...(data?.starters || [])].map((s) => (
                <p key={s} className="rounded-2xl bg-light px-4 py-3 text-sm font-semibold">
                  {s}
                </p>
              ))}
            </>
          )}
          {tab === 'phrases' &&
            data?.phrases.map((p) => (
              <div key={p.text} className="rounded-2xl bg-light px-4 py-3">
                <p className="text-sm font-bold">{p.text}</p>
                {p.note && <p className="text-xs text-ink/50">{p.note}</p>}
              </div>
            ))}
          {tab === 'words' &&
            (data?.words.length ? (
              data.words.map((w) => (
                <div key={w.word} className="rounded-2xl bg-light px-4 py-3">
                  <p className="text-sm font-extrabold text-secondary">{w.word}</p>
                  <p className="text-sm">{w.meaning}</p>
                  {w.example && <p className="mt-0.5 text-xs italic text-ink/50">"{w.example}"</p>}
                </div>
              ))
            ) : (
              <p className="muted py-4 text-center">No vocabulary for this topic yet.</p>
            ))}
        </div>
      )}
    </Sheet>
  );
}

function AudioSheet({ open, onClose }) {
  const volume = useCallStore((s) => s.volume);
  const speakerMuted = useCallStore((s) => s.speakerMuted);
  const [outputs, setOutputs] = useState([]);
  const [sink, setSink] = useState('default');
  const supported = engine.supportsOutputSelection;

  useEffect(() => {
    if (open && supported) engine.listOutputs().then(setOutputs).catch(() => {});
  }, [open, supported]);

  return (
    <Sheet open={open} onClose={onClose} title="Audio settings">
      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label !mb-0">Partner volume</span>
            <button onClick={() => engine.toggleSpeaker()} className="chip !py-1.5">
              {speakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {speakerMuted ? 'Muted' : 'On'}
            </button>
          </div>
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => engine.setVolume(Number(e.target.value))} className="range-green w-full" aria-label="Partner volume" />
        </div>
        {supported ? (
          <div>
            <span className="label">Speaker / headphones</span>
            <Select
              value={sink}
              onChange={async (v) => {
                setSink(v);
                await engine.setOutput(v);
              }}
              options={[{ value: 'default', label: 'Default output' }, ...outputs.filter((o) => o.deviceId !== 'default').map((o) => ({ value: o.deviceId, label: o.label || 'Audio output' }))]}
            />
          </div>
        ) : (
          <p className="rounded-2xl bg-light p-3 text-xs text-ink/55">Your browser does not support choosing an output device. Use your system sound settings to switch between speaker and headphones.</p>
        )}
      </div>
    </Sheet>
  );
}

export default function CallScreen() {
  const phase = useCallStore((s) => s.phase);
  const partner = useCallStore((s) => s.partner);
  const topic = useCallStore((s) => s.topic);
  const callId = useCallStore((s) => s.callId);
  const connection = useCallStore((s) => s.connection);
  const quality = useCallStore((s) => s.quality);
  const muted = useCallStore((s) => s.muted);
  const speakerMuted = useCallStore((s) => s.speakerMuted);
  const audioBlocked = useCallStore((s) => s.audioBlocked);
  const partnerStatus = useCallStore((s) => s.partnerStatus);
  const maxDuration = useCallStore((s) => s.maxDurationSec);
  const analysers = useCallStore((s) => s.analysers);
  const seconds = useCallSeconds();
  const partnerSpeaking = useSpeaking(analysers.remote);
  const meSpeaking = useSpeaking(analysers.local) && !muted;
  const [sheet, setSheet] = useState(null); // assist | audio | report

  if (!['connecting', 'in_call'].includes(phase) || !partner) return <Navigate to={pathForPhase(phase)} replace />;

  const live = phase === 'in_call';
  const remaining = maxDuration ? maxDuration - seconds : null;
  const status = partnerStatus === 'reconnecting' ? 'Partner is reconnecting...' : connection === 'reconnecting' ? 'Reconnecting audio...' : live ? 'In call' : 'Connecting';

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-gradient-to-b from-secondary via-secondary to-ink px-5 pb-safe pt-safe text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between gap-2 pt-4">
        <QualityIndicator quality={quality} connection={connection} />
        {topic && <Badge tone="gray" className="!bg-white/10 !text-white">{topic.title}</Badge>}
        <button onClick={() => setSheet('report')} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Report or block">
          <ShieldAlert className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Partner */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative">
          {partnerSpeaking && <span className="absolute inset-0 animate-ripple rounded-full bg-primary/40" />}
          <Avatar src={partner.avatarUrl} name={partner.displayName} size={148} speaking={partnerSpeaking} />
        </div>
        <h1 className="mt-5 text-3xl font-extrabold">{partner.displayName}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <LevelBadge level={partner.englishLevel} />
          {partner.country && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{partner.country}</span>}
        </div>

        <p className="mt-6 font-mono text-5xl font-bold tabular-nums tracking-tight" aria-live="off">
          {live ? formatClock(seconds) : '--:--'}
        </p>
        <p className={cx('mt-1.5 flex items-center gap-1.5 text-sm font-semibold', connection === 'reconnecting' || partnerStatus === 'reconnecting' ? 'text-amber-300' : 'text-white/70')}>
          {(connection === 'reconnecting' || partnerStatus === 'reconnecting') && <WifiOff className="h-4 w-4" />}
          {!live && connection !== 'reconnecting' && <Spinner className="h-3.5 w-3.5" />}
          {status}
        </p>
        {remaining !== null && live && remaining <= 60 && remaining > 0 && <p className="mt-1 text-xs font-bold text-amber-300">Call ends in {formatClock(remaining)}</p>}

        <div className="mt-8 w-full max-w-xs">
          <Waveform analyser={analysers.remote} bars={32} height={64} active={live} />
          <p className="mt-1 text-[11px] font-semibold text-white/45">{partner.displayName.split(' ')[0]} {partnerSpeaking ? 'is speaking' : ''}</p>
        </div>
      </div>

      {/* Me */}
      <div className="relative z-10 mx-auto mb-5 flex w-full max-w-xs items-center gap-3 rounded-3xl bg-white/10 px-4 py-3">
        <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', muted ? 'bg-red-500/80' : meSpeaking ? 'bg-primary text-secondary' : 'bg-white/15')}>
          {muted ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
        </span>
        <div className="flex-1">
          <Waveform analyser={muted ? null : analysers.local} color="primary" bars={26} height={28} active={!muted} />
        </div>
        <span className="text-[11px] font-bold text-white/60">{muted ? 'Muted' : 'You'}</span>
      </div>

      {audioBlocked && (
        <button onClick={() => engine.resumeAudio()} className="relative z-10 mx-auto mb-3 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-extrabold text-ink shadow-lg">
          Tap to hear your partner
        </button>
      )}

      {/* Controls */}
      <div className="relative z-10 grid grid-cols-5 items-end gap-1 pb-5">
        <ControlButton icon={muted ? MicOff : Mic} label={muted ? 'Unmute' : 'Mute'} active={muted} onClick={() => engine.toggleMute()} />
        <ControlButton icon={speakerMuted ? VolumeX : Volume2} label="Speaker" active={speakerMuted} onClick={() => setSheet('audio')} />
        <ControlButton icon={PhoneOff} label="End call" danger big onClick={() => engine.endCall()} />
        <ControlButton icon={SkipForward} label="Next" onClick={() => engine.nextPartner()} />
        <ControlButton icon={BookOpen} label="Helper" onClick={() => setSheet('assist')} />
      </div>

      <AssistantSheet open={sheet === 'assist'} onClose={() => setSheet(null)} topic={topic} />
      <AudioSheet open={sheet === 'audio'} onClose={() => setSheet(null)} />
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} partner={partner} callKey={callId} />
    </div>
  );
}
