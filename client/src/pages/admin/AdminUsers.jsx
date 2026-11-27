import { useEffect, useState } from 'react';
import { Ban, Crown, Search, Trash2, UserCheck } from 'lucide-react';
import Avatar from '../../components/Avatar';
import { Badge, Button, ConfirmSheet, Field, LevelBadge, Select, Sheet, Skeleton } from '../../components/ui';
import { useDebounced, useFetch } from '../../hooks';
import { adminApi } from '../../lib/adminApi';
import { errMsg } from '../../lib/api';
import { COUNTRIES, GOALS, LANGUAGES, LEVELS, PRACTICE_LANGUAGES } from '../../lib/constants';
import { formatDate, formatDuration, formatMinutes } from '../../lib/format';
import { useAppStore } from '../../store/appStore';
import { DataTable, OnlineDot, PageTitle, Pager, StatusBadge, Tabs, useCan } from './AdminUI';

function UserDetail({ target, onClose, onChanged }) {
  const can = useCan();
  const toast = useAppStore((s) => s.toast);
  const { id, kind } = target;
  const { data, loading, reload } = useFetch(() => adminApi.get(`/users/${id}`, { params: { kind } }).then((r) => r.data), [id, kind]);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [restrict, setRestrict] = useState({ status: 'suspended', reason: '', days: 7 });

  useEffect(() => {
    if (data) {
      const u = data.user;
      setForm({ displayName: u.displayName, country: u.country, nativeLanguage: u.nativeLanguage, englishLevel: u.englishLevel, practiceLanguage: u.practiceLanguage, learningGoals: u.learningGoals });
    }
  }, [data]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    try {
      await fn();
      toast(ok, 'success');
      await reload();
      onChanged();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy('');
    }
  };

  const u = data?.user;
  return (
    <Sheet open onClose={onClose} title={u ? u.displayName : 'User'} wide>
      {loading || !u || !form ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar src={u.avatarUrl} name={u.displayName} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={u.status} />
                <StatusBadge value={u.plan} />
                <OnlineDot state={u.presence} />
              </div>
              <p className="mt-1 truncate text-sm text-ink/60">{u.email || 'Guest session'}</p>
              <p className="text-xs text-ink/40">
                Public ID {u.publicId} · joined {formatDate(u.createdAt)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Calls', u.stats.totalCalls],
              ['Minutes', formatMinutes(u.stats.totalMinutes)],
              ['Streak', u.stats.streak],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-light p-3">
                <p className="text-lg font-extrabold text-secondary">{v}</p>
                <p className="text-[11px] font-semibold text-ink/50">{k}</p>
              </div>
            ))}
          </div>

          {u.statusReason && <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">Reason: {u.statusReason}</p>}

          {can('users.restrict') && (
            <section className="space-y-3 rounded-3xl border border-secondary/10 p-4">
              <h3 className="font-extrabold text-secondary">Restrictions</h3>
              {u.status === 'active' ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Select value={restrict.status} onChange={(v) => setRestrict({ ...restrict, status: v })} options={[{ value: 'suspended', label: 'Suspend' }, { value: 'blocked', label: 'Block permanently' }]} />
                    {restrict.status === 'suspended' && kind === 'user' && (
                      <input type="number" min={1} max={365} className="input" value={restrict.days} onChange={(e) => setRestrict({ ...restrict, days: Number(e.target.value) })} aria-label="Days" placeholder="Days" />
                    )}
                    <input className="input sm:col-span-1" placeholder="Reason" value={restrict.reason} onChange={(e) => setRestrict({ ...restrict, reason: e.target.value })} />
                  </div>
                  <Button
                    className="btn-danger btn-sm"
                    loading={busy === 'status'}
                    onClick={() => run('status', () => adminApi.post(`/users/${id}/status`, { status: restrict.status, reason: restrict.reason || undefined, days: restrict.status === 'suspended' && kind === 'user' ? restrict.days : undefined }, { params: { kind } }), 'User restricted')}
                  >
                    <Ban className="h-4 w-4" /> Apply restriction
                  </Button>
                </>
              ) : (
                <Button className="btn-primary btn-sm" loading={busy === 'status'} onClick={() => run('status', () => adminApi.post(`/users/${id}/status`, { status: 'active' }, { params: { kind } }), 'User re-activated')}>
                  <UserCheck className="h-4 w-4" /> Unblock / reactivate
                </Button>
              )}
            </section>
          )}

          {can('users.edit') && (
            <section className="space-y-3 rounded-3xl border border-secondary/10 p-4">
              <h3 className="font-extrabold text-secondary">Edit profile</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Display name">
                  <input className="input" maxLength={40} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
                </Field>
                <Field label="Country">
                  <Select value={form.country} onChange={(v) => setForm({ ...form, country: v })} options={COUNTRIES} placeholder="Country" />
                </Field>
                <Field label="Native language">
                  <Select value={form.nativeLanguage} onChange={(v) => setForm({ ...form, nativeLanguage: v })} options={LANGUAGES} placeholder="Language" />
                </Field>
                <Field label="English level">
                  <Select value={form.englishLevel} onChange={(v) => setForm({ ...form, englishLevel: v })} options={LEVELS.map((l) => ({ value: l.value, label: l.label }))} />
                </Field>
                <Field label="Practice language">
                  <Select value={form.practiceLanguage} onChange={(v) => setForm({ ...form, practiceLanguage: v })} options={PRACTICE_LANGUAGES} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GOALS.map((g) => (
                  <button key={g.value} type="button" className={`chip !py-1 text-xs ${form.learningGoals.includes(g.value) ? 'chip-active' : ''}`} onClick={() => setForm({ ...form, learningGoals: form.learningGoals.includes(g.value) ? form.learningGoals.filter((x) => x !== g.value) : [...form.learningGoals, g.value] })}>
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="btn-primary btn-sm" loading={busy === 'edit'} onClick={() => run('edit', () => adminApi.patch(`/users/${id}`, form, { params: { kind } }), 'Profile saved')}>
                  Save profile
                </Button>
                {u.avatarUrl && (
                  <Button className="btn-ghost btn-sm" loading={busy === 'avatar'} onClick={() => run('avatar', () => adminApi.patch(`/users/${id}`, { removeAvatar: true }, { params: { kind } }), 'Picture removed')}>
                    Remove picture
                  </Button>
                )}
              </div>
            </section>
          )}

          {kind === 'user' && can('users.premium') && (
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-secondary/10 p-4">
              <div>
                <h3 className="font-extrabold text-secondary">Plan</h3>
                <p className="text-sm text-ink/60">{u.plan === 'premium' ? `Premium${u.planExpiresAt ? ` until ${formatDate(u.planExpiresAt)}` : ' (no expiry)'}` : 'Free plan'}</p>
              </div>
              {u.plan === 'premium' ? (
                <Button className="btn-ghost btn-sm" loading={busy === 'plan'} onClick={() => run('plan', () => adminApi.post(`/users/${id}/premium`, { grant: false }, { params: { kind } }), 'Premium removed')}>
                  Remove premium
                </Button>
              ) : (
                <Button className="btn-soft btn-sm" loading={busy === 'plan'} onClick={() => run('plan', () => adminApi.post(`/users/${id}/premium`, { grant: true, days: 30, note: 'Granted by admin' }, { params: { kind } }), 'Premium granted for 30 days')}>
                  <Crown className="h-4 w-4" /> Grant 30 days
                </Button>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-2 font-extrabold text-secondary">Recent calls (metadata only)</h3>
            {data.calls.length ? (
              <ul className="divide-y divide-ink/5 rounded-2xl bg-light text-sm">
                {data.calls.map((c) => (
                  <li key={c.callKey} className="flex items-center justify-between gap-2 px-3 py-2.5">
                    <span className="truncate">{c.participants.map((p) => p.displayName).join(' + ')}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge value={c.status} />
                      <span className="text-xs text-ink/50">{formatDuration(c.durationSec)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No calls.</p>
            )}
          </section>

          <section>
            <h3 className="mb-2 font-extrabold text-secondary">Reports against this user</h3>
            {data.reports.length ? (
              <ul className="space-y-1.5 text-sm">
                {data.reports.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-2xl bg-light px-3 py-2">
                    <span className="capitalize">{r.reason.replace(/_/g, ' ')}</span>
                    <span className="flex items-center gap-2">
                      <StatusBadge value={r.status} />
                      <span className="text-xs text-ink/45">{formatDate(r.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No reports.</p>
            )}
          </section>

          {can('users.delete') && (
            <button className="flex items-center gap-2 text-sm font-bold text-red-600" onClick={() => setConfirm('delete')}>
              <Trash2 className="h-4 w-4" /> Delete this {kind === 'guest' ? 'guest session' : 'user'}
            </button>
          )}
        </div>
      )}

      <ConfirmSheet
        open={confirm === 'delete'}
        title="Delete permanently?"
        text="This removes the profile, history, favorites and notifications. It cannot be undone."
        confirmLabel="Delete"
        danger
        loading={busy === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          setBusy('delete');
          try {
            await adminApi.delete(`/users/${id}`, { params: { kind } });
            toast('User deleted', 'success');
            onChanged();
            onClose();
          } catch (e) {
            toast(errMsg(e), 'error');
          } finally {
            setBusy('');
            setConfirm(null);
          }
        }}
      />
    </Sheet>
  );
}

export default function AdminUsers() {
  const [kind, setKind] = useState('user');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const dq = useDebounced(q);
  const { data, loading, reload } = useFetch(() => adminApi.get('/users', { params: { kind, q: dq || undefined, status: status || undefined, page } }).then((r) => r.data), [kind, dq, status, page]);

  useEffect(() => setPage(1), [kind, dq, status]);

  const columns = [
    {
      key: 'name',
      label: 'User',
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <Avatar src={u.avatarUrl} name={u.displayName} size={34} />
          <div className="min-w-0">
            <p className="max-w-[170px] truncate font-bold">{u.displayName}</p>
            <p className="max-w-[170px] truncate text-xs text-ink/45">{u.email || u.publicId}</p>
          </div>
        </div>
      ),
    },
    { key: 'level', label: 'Level', render: (u) => <LevelBadge level={u.englishLevel} long={false} /> },
    { key: 'country', label: 'Country', render: (u) => u.country || '-' },
    { key: 'status', label: 'Status', render: (u) => <StatusBadge value={u.status} /> },
    ...(kind === 'user' ? [{ key: 'plan', label: 'Plan', render: (u) => <StatusBadge value={u.plan} /> }] : []),
    { key: 'calls', label: 'Calls / min', render: (u) => `${u.stats.totalCalls} / ${formatMinutes(u.stats.totalMinutes)}` },
    { key: 'reports', label: 'Reports', render: (u) => (u.reports ? <Badge tone="red">{u.reports}</Badge> : '-') },
    { key: 'presence', label: 'Now', render: (u) => <OnlineDot state={u.presence} /> },
    { key: 'joined', label: 'Joined', render: (u) => formatDate(u.createdAt).split(',')[0] },
  ];

  return (
    <>
      <PageTitle title="User management" subtitle="Search, edit, restrict and manage accounts.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input className="input !w-64 !py-2.5 pl-10" placeholder="Search name, email or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="w-40">
          <Select value={status} onChange={setStatus} options={[{ value: '', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'blocked', label: 'Blocked' }]} className="!py-2.5" />
        </div>
      </PageTitle>
      <Tabs
        tabs={[
          ['user', 'Registered users'],
          ['guest', 'Guest sessions'],
        ]}
        value={kind}
        onChange={setKind}
      />
      <DataTable columns={columns} rows={data?.items} loading={loading} onRowClick={(u) => setSelected({ id: u.id, kind: u.kind })} empty="No users match your search" />
      <Pager page={page} pages={data?.pages} onPage={setPage} />
      <p className="mt-3 text-xs text-ink/45">{data?.total ?? 0} total. Click a row to manage. Admins never see private audio; only call metadata.</p>
      {selected && <UserDetail target={selected} onClose={() => setSelected(null)} onChanged={reload} />}
    </>
  );
}
