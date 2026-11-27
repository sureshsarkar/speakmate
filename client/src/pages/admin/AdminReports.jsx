import { useEffect, useState } from 'react';
import { Badge, Button, Field, Select, Sheet, Skeleton } from '../../components/ui';
import { useFetch } from '../../hooks';
import { adminApi } from '../../lib/adminApi';
import { errMsg } from '../../lib/api';
import { formatDate, formatDuration } from '../../lib/format';
import { useAppStore } from '../../store/appStore';
import { DataTable, PageTitle, Pager, StatusBadge, Tabs, useCan } from './AdminUI';

const reason = (r) => r.replace(/_/g, ' ');

function Investigate({ id, onClose, onSaved }) {
  const can = useCan();
  const toast = useAppStore((s) => s.toast);
  const { data, loading, reload } = useFetch(() => adminApi.get(`/reports/${id}`).then((r) => r.data), [id]);
  const [form, setForm] = useState({ status: 'investigating', adminNote: '', action: 'none' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm({ status: data.report.status === 'open' ? 'investigating' : data.report.status, adminNote: data.report.adminNote || '', action: 'none' });
  }, [data]);

  const save = async () => {
    setBusy(true);
    try {
      await adminApi.patch(`/reports/${id}`, form);
      toast('Report updated', 'success');
      onSaved();
      await reload();
      setForm((f) => ({ ...f, action: 'none' }));
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const r = data?.report;
  const target = data?.reportedUser;
  return (
    <Sheet open onClose={onClose} title="Investigate report" wide>
      {loading || !r ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={r.status} />
            <Badge tone="red">{reason(r.reason)}</Badge>
            <span className="text-xs text-ink/45">{formatDate(r.createdAt)}</span>
          </div>
          {r.details && <p className="rounded-2xl bg-light p-4 text-sm">"{r.details}"</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-secondary/10 p-3.5 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Reported user</p>
              <p className="mt-1 font-extrabold">{r.reported.displayName}</p>
              <p className="text-xs text-ink/50">{r.reported.kind === 'guest' ? 'Guest' : 'Registered'} · {r.reported.publicId}</p>
              {target && (
                <p className="mt-1 flex items-center gap-2">
                  <StatusBadge value={target.status} /> <span className="text-xs text-ink/50">{target.stats.totalCalls} calls</span>
                </p>
              )}
              {!target && <p className="mt-1 text-xs text-amber-700">Account no longer exists.</p>}
            </div>
            <div className="rounded-2xl border border-secondary/10 p-3.5 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Reported by</p>
              <p className="mt-1 font-bold">{r.reporter.kind === 'guest' ? 'Guest' : 'Registered user'}</p>
              <p className="text-xs text-ink/50">{r.reporter.publicId}</p>
              {data.call && (
                <p className="mt-2 text-xs text-ink/60">
                  Call: {formatDuration(data.call.durationSec)} · {data.call.status} · {data.call.topic || 'free talk'}
                </p>
              )}
            </div>
          </div>

          <p className="text-sm">
            <b>{r.reportedTotalReports ?? data.otherReports.length + 1}</b> total reports against this user.
          </p>
          {data.otherReports.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {data.otherReports.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-2xl bg-light px-3 py-2">
                  <span className="capitalize">{reason(o.reason)}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge value={o.status} />
                    <span className="text-xs text-ink/45">{formatDate(o.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 rounded-3xl border border-secondary/10 p-4">
            <h3 className="font-extrabold text-secondary">Resolution</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Status">
                <Select value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={['open', 'investigating', 'resolved', 'dismissed']} />
              </Field>
              <Field label="Action on reported user">
                <Select
                  value={form.action}
                  onChange={(v) => setForm({ ...form, action: v })}
                  options={[
                    { value: 'none', label: 'No action' },
                    { value: 'warn', label: 'Send warning' },
                    ...(can('users.restrict') ? [{ value: 'suspend', label: 'Suspend 7 days' }, { value: 'block', label: 'Block permanently' }] : []),
                  ]}
                />
              </Field>
            </div>
            <Field label="Internal note">
              <textarea className="input resize-none" rows={3} maxLength={1000} value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} />
            </Field>
            {r.action && r.action !== 'none' && <p className="text-xs font-semibold text-ink/55">Previous action: {r.action}</p>}
            <Button className="btn-primary" loading={busy} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export default function AdminReports() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const { data, loading, reload } = useFetch(() => adminApi.get('/reports', { params: { status: status || undefined, page } }).then((r) => r.data), [status, page]);

  return (
    <>
      <PageTitle title="Moderation" subtitle="Review reports, investigate complaints and restrict abusive users." />
      <Tabs
        tabs={[
          ['open', 'Open'],
          ['investigating', 'Investigating'],
          ['resolved', 'Resolved'],
          ['dismissed', 'Dismissed'],
          ['', 'All'],
        ]}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />
      <DataTable
        loading={loading}
        rows={data?.items}
        empty="No reports in this list"
        onRowClick={(r) => setSelected(r.id)}
        columns={[
          { key: 'u', label: 'Reported user', render: (r) => <div><p className="font-bold">{r.reported.displayName}</p><p className="text-xs text-ink/45">{r.reported.kind}</p></div> },
          { key: 'reason', label: 'Reason', render: (r) => <span className="capitalize">{reason(r.reason)}</span> },
          { key: 'n', label: 'Total reports', render: (r) => (r.reportedTotalReports > 2 ? <Badge tone="red">{r.reportedTotalReports}</Badge> : r.reportedTotalReports) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge value={r.status} /> },
          { key: 'action', label: 'Action', render: (r) => (r.action && r.action !== 'none' ? r.action : '-') },
          { key: 'at', label: 'Reported', render: (r) => formatDate(r.createdAt) },
        ]}
      />
      <Pager page={page} pages={data?.pages} onPage={setPage} />
      {selected && <Investigate id={selected} onClose={() => setSelected(null)} onSaved={reload} />}
    </>
  );
}
