import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, ConfirmSheet, Field, Select, Sheet, Toggle } from '../../components/ui';
import { useFetch } from '../../hooks';
import { adminApi } from '../../lib/adminApi';
import { errMsg } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAdminStore } from '../../store/adminStore';
import { useAppStore } from '../../store/appStore';
import { DataTable, PageTitle, StatusBadge } from './AdminUI';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin: full access' },
  { value: 'moderator', label: 'Moderator: reports, restrictions, calls' },
  { value: 'support', label: 'Support Admin: users, content (no restrictions)' },
];

function AdminForm({ item, onClose, onSaved }) {
  const toast = useAppStore((s) => s.toast);
  const isNew = !item;
  const [f, setF] = useState(item ? { name: item.name, role: item.role, active: item.active, password: '' } : { email: '', name: '', role: 'support', password: '' });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f };
      if (!isNew && !body.password) delete body.password;
      if (isNew) await adminApi.post('/admins', body);
      else await adminApi.patch(`/admins/${item.id}`, body);
      toast('Saved', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add admin' : `Edit ${item.name}`}>
      <div className="space-y-4">
        {isNew && (
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
        )}
        <Field label="Name">
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Role">
          <Select value={f.role} onChange={(v) => setF({ ...f, role: v })} options={ROLES} />
        </Field>
        <Field label={isNew ? 'Password' : 'New password (optional)'} hint="At least 8 characters with a letter and a number.">
          <input className="input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        {!isNew && (
          <div className="flex items-center justify-between rounded-2xl bg-light px-4 py-3">
            <span className="text-sm font-bold">Account active</span>
            <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Active" />
          </div>
        )}
        <Button className="btn-primary w-full" loading={busy} onClick={save}>
          {isNew ? 'Create admin' : 'Save changes'}
        </Button>
      </div>
    </Sheet>
  );
}

export default function AdminAdmins() {
  const toast = useAppStore((s) => s.toast);
  const me = useAdminStore((s) => s.admin);
  const { data, loading, reload } = useFetch(() => adminApi.get('/admins').then((r) => r.data.items), []);
  const [editing, setEditing] = useState(null); // undefined closed, null new, object edit
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const remove = async () => {
    try {
      await adminApi.delete(`/admins/${deleting.id}`);
      toast('Admin deleted', 'success');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageTitle title="Admin accounts" subtitle="Super Admin, Moderator and Support Admin roles.">
        <Button
          className="btn-primary btn-sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add admin
        </Button>
      </PageTitle>
      <DataTable
        loading={loading}
        rows={data}
        onRowClick={(a) => {
          setEditing(a);
          setOpen(true);
        }}
        columns={[
          { key: 'name', label: 'Admin', render: (a) => <div><p className="font-bold">{a.name}{a.id === me?.id && <span className="ml-1.5 text-xs text-ink/40">(you)</span>}</p><p className="text-xs text-ink/45">{a.email}</p></div> },
          { key: 'role', label: 'Role', render: (a) => <span className="capitalize">{a.role.replace('_', ' ')}</span> },
          { key: 'active', label: 'Status', render: (a) => <StatusBadge value={a.active ? 'active' : 'blocked'} /> },
          { key: 'last', label: 'Last login', render: (a) => (a.lastLoginAt ? formatDate(a.lastLoginAt) : 'Never') },
          {
            key: 'act',
            label: '',
            render: (a) =>
              a.id !== me?.id && (
                <button
                  className="rounded-full bg-red-50 p-2 text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(a);
                  }}
                  aria-label="Delete admin"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ),
          },
        ]}
      />
      <div className="card mt-6 text-sm text-ink/70">
        <p className="font-extrabold text-secondary">Role permissions</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><b>Super Admin</b>: everything, including settings, admins, deleting users and granting premium.</li>
          <li><b>Moderator</b>: view users, suspend/block, handle reports, end calls.</li>
          <li><b>Support Admin</b>: view/edit users, manage content (topics, vocabulary, resources, FAQs).</li>
        </ul>
        <p className="mt-2 text-xs text-ink/50">No role can listen to live audio or recordings. They do not exist.</p>
      </div>
      {open && <AdminForm key={editing?.id || 'new'} item={editing} onClose={() => setOpen(false)} onSaved={reload} />}
      <ConfirmSheet open={Boolean(deleting)} title={`Delete ${deleting?.name}?`} text="This admin will lose access immediately." confirmLabel="Delete" danger onConfirm={remove} onClose={() => setDeleting(null)} />
    </>
  );
}
