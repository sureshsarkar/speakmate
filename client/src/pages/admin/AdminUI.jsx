import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Skeleton, cx } from '../../components/ui';
import { useAdminStore } from '../../store/adminStore';

export const useCan = () => {
  const perms = useAdminStore((s) => s.admin?.permissions) || [];
  return (p) => perms.includes(p);
};

export function PageTitle({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-secondary">{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'bg-primary/20 text-secondary', sub }) {
  return (
    <div className="card flex items-center gap-3.5 !p-4">
      <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', tone)}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none text-secondary">{value ?? '-'}</p>
        <p className="mt-1 truncate text-xs font-semibold text-ink/55">{label}</p>
        {sub && <p className="text-[10px] text-ink/40">{sub}</p>}
      </div>
    </div>
  );
}

export function DataTable({ columns, rows, loading, empty = 'Nothing to show', onRowClick, rowKey = 'id' }) {
  if (loading && !rows?.length) return <Skeleton className="h-56" />;
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-ink/5 bg-light/60">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="th">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {rows?.map((r, i) => (
            <tr key={r[rowKey] ?? i} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cx(onRowClick && 'cursor-pointer hover:bg-light/70')}>
              {columns.map((c) => (
                <td key={c.key} className="td">
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {!rows?.length && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-ink/45">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, pages, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3 text-sm font-bold">
      <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={cx('chip', value === k && 'chip-active')}>
          {l}
        </button>
      ))}
    </div>
  );
}

const TONES = {
  active: 'green',
  completed: 'green',
  in_call: 'green',
  resolved: 'green',
  premium: 'dark',
  suspended: 'amber',
  investigating: 'amber',
  connecting: 'amber',
  open: 'red',
  blocked: 'red',
  failed: 'red',
  dismissed: 'gray',
  cancelled: 'gray',
  free: 'gray',
};
export const StatusBadge = ({ value }) => <Badge tone={TONES[value] || 'gray'}>{String(value).replace(/_/g, ' ')}</Badge>;

export const OnlineDot = ({ state }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
    <i className={cx('block h-2 w-2 rounded-full', state === 'offline' ? 'bg-ink/25' : state === 'online' ? 'bg-emerald-500' : 'bg-amber-400')} />
    {state === 'offline' ? 'Offline' : state === 'online' ? 'Online' : state.replace(/_/g, ' ')}
  </span>
);
