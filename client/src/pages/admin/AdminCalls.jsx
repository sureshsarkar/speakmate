import { useState } from 'react';
import { Activity, CheckCircle2, Clock, Cpu, Database, Radio, Server, ShieldCheck, Signal, XCircle } from 'lucide-react';
import { Button, Select } from '../../components/ui';
import { useFetch } from '../../hooks';
import { adminApi } from '../../lib/adminApi';
import { errMsg } from '../../lib/api';
import { formatClock, formatDate, formatDuration } from '../../lib/format';
import { useAppStore } from '../../store/appStore';
import { DataTable, PageTitle, Pager, StatCard, StatusBadge, Tabs, useCan } from './AdminUI';

const names = (c) => c.participants.map((p) => `${p.displayName}${p.kind === 'guest' ? ' (guest)' : ''}`).join('  +  ');

function Active() {
  const can = useCan();
  const toast = useAppStore((s) => s.toast);
  const { data, loading, reload } = useFetch(() => adminApi.get('/calls/active').then((r) => r.data), [], { interval: 3000 });
  const end = async (c) => {
    try {
      await adminApi.post(`/calls/${c.callKey}/end`);
      toast('Call ended', 'success');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  return (
    <>
      <p className="mb-3 text-sm text-ink/60">
        {data?.items.length || 0} active · {data?.searching || 0} searching. Metadata only; audio is peer to peer and never accessible to admins.
      </p>
      <DataTable
        loading={loading}
        rowKey="callKey"
        rows={data?.items}
        empty="No active calls right now"
        columns={[
          { key: 'p', label: 'Participants', render: names },
          { key: 'kind', label: 'Type', render: (c) => <span className="capitalize">{c.kind}</span> },
          { key: 'status', label: 'Status', render: (c) => <StatusBadge value={c.status} /> },
          { key: 'dur', label: 'Duration', render: (c) => <span className="font-mono">{formatClock(c.durationSec)}</span> },
          { key: 'quality', label: 'Quality', render: (c) => (c.quality ? <StatusBadge value={c.quality} /> : '-') },
          { key: 'conn', label: 'Connected', render: (c) => c.participants.map((p) => (p.connected ? '●' : '○')).join(' ') },
          ...(can('calls.end') ? [{ key: 'act', label: '', render: (c) => <Button className="btn-ghost btn-sm !text-red-600" onClick={() => end(c)}>End call</Button> }] : []),
        ]}
      />
    </>
  );
}

function History() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading } = useFetch(() => adminApi.get('/calls/history', { params: { status: status || undefined, page } }).then((r) => r.data), [status, page]);
  return (
    <>
      <div className="mb-3 w-48">
        <Select
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[{ value: '', label: 'All statuses' }, ...['completed', 'failed', 'cancelled', 'in_call', 'connecting'].map((s) => ({ value: s, label: s.replace('_', ' ') }))]}
          className="!py-2.5"
        />
      </div>
      <DataTable
        loading={loading}
        rowKey="callKey"
        rows={data?.items}
        empty="No calls recorded yet"
        columns={[
          { key: 'p', label: 'Participants', render: names },
          { key: 'topic', label: 'Topic', render: (c) => c.topic || '-' },
          { key: 'status', label: 'Status', render: (c) => <StatusBadge value={c.status} /> },
          { key: 'dur', label: 'Duration', render: (c) => formatDuration(c.durationSec) },
          { key: 'conn', label: 'Connect time', render: (c) => (c.connectMs ? `${(c.connectMs / 1000).toFixed(1)}s` : '-') },
          { key: 'quality', label: 'Quality', render: (c) => (c.quality ? <StatusBadge value={c.quality} /> : '-') },
          { key: 'end', label: 'End reason', render: (c) => (c.endReason || '-').replace(/_/g, ' ') },
          { key: 'at', label: 'Started', render: (c) => formatDate(c.createdAt) },
        ]}
      />
      <Pager page={page} pages={data?.pages} onPage={setPage} />
    </>
  );
}

function Health() {
  const { data, loading } = useFetch(() => adminApi.get('/calls/health').then((r) => r.data.health), [], { interval: 5000 });
  if (loading && !data) return null;
  const h = data;
  const l = h.last24h;
  const hrs = Math.floor(h.uptimeSec / 3600);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Server} label="Server uptime" value={`${hrs}h ${Math.floor((h.uptimeSec % 3600) / 60)}m`} sub={`${h.memoryMB} MB memory`} />
        <StatCard icon={Database} label="Database" value={h.dbState} tone={h.dbState === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'} />
        <StatCard icon={Radio} label="Socket connections" value={h.socketConnections} tone="bg-sky-100 text-sky-700" sub={`${h.queueSize} in queue`} />
        <StatCard icon={Activity} label="Active calls" value={h.activeCalls} tone="bg-violet-100 text-violet-700" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-extrabold text-secondary">
            <Signal className="h-5 w-5" /> Audio system (last 24 hours)
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Calls started', l.calls],
              ['Completed', l.completed],
              ['Failed to connect', l.failed],
              ['Connect success rate', l.connectSuccessRate == null ? '-' : `${l.connectSuccessRate}%`],
              ['Avg time to connect', l.avgConnectSec == null ? '-' : `${l.avgConnectSec}s`],
              ['Avg call length', l.avgDurationSec == null ? '-' : formatDuration(l.avgDurationSec)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-light p-3">
                <dt className="text-xs font-semibold text-ink/50">{k}</dt>
                <dd className="mt-0.5 text-xl font-extrabold text-secondary">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {Object.entries(l.quality).map(([q, n]) => (
              <span key={q} className="flex items-center gap-1.5"><StatusBadge value={q} /> {n}</span>
            ))}
          </div>
          {l.failureReasons.length > 0 && (
            <div>
              <p className="label">Failure reasons</p>
              <ul className="text-sm">
                {l.failureReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between border-b border-ink/5 py-1.5">
                    <span className="capitalize">{r.reason.replace(/_/g, ' ')}</span>
                    <b>{r.count}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-extrabold text-secondary">
            <Cpu className="h-5 w-5" /> Infrastructure
          </h2>
          {[
            ['TURN relay configured', h.turnConfigured, 'Needed for users behind strict firewalls or mobile carrier NAT'],
            ['Redis adapter', h.redisAdapter, 'Required to run more than one server instance'],
          ].map(([k, ok, hint]) => (
            <div key={k} className="flex items-start gap-3 rounded-2xl bg-light p-3">
              {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 text-amber-500" />}
              <div>
                <p className="text-sm font-bold">
                  {k}: {ok ? 'Yes' : 'No'}
                </p>
                <p className="text-xs text-ink/50">{hint}</p>
              </div>
            </div>
          ))}
          <p className="flex items-center gap-2 text-xs text-ink/50">
            <ShieldCheck className="h-4 w-4" /> Audio never touches this server. Only signalling metadata does.
          </p>
          <p className="flex items-center gap-2 text-xs text-ink/50">
            <Clock className="h-4 w-4" /> Auto-refreshes every 5 seconds.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function AdminCalls() {
  const [tab, setTab] = useState('active');
  return (
    <>
      <PageTitle title="Audio calls" subtitle="Active calls, history metadata and audio system health." />
      <Tabs
        tabs={[
          ['active', 'Active calls'],
          ['history', 'Call history'],
          ['health', 'System health'],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'active' && <Active />}
      {tab === 'history' && <History />}
      {tab === 'health' && <Health />}
    </>
  );
}
