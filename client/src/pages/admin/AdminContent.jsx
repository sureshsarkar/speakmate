import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, ConfirmSheet, Field, Select, Sheet, Toggle } from '../../components/ui';
import { useFetch } from '../../hooks';
import { adminApi } from '../../lib/adminApi';
import { errMsg } from '../../lib/api';
import { LEVELS } from '../../lib/constants';
import { useAppStore } from '../../store/appStore';
import { DataTable, PageTitle, Tabs } from './AdminUI';

const LEVEL_OPTS = LEVELS.map((l) => ({ value: l.value, label: l.label }));

const TYPES = {
  topics: {
    label: 'Conversation topics',
    blank: { slug: '', title: '', icon: '💬', description: '', starters: [], premium: false, active: true, order: 0 },
    columns: [
      { key: 'icon', label: '', render: (r) => <span className="text-xl">{r.icon}</span> },
      { key: 'title', label: 'Title', render: (r) => <b>{r.title}</b> },
      { key: 'slug', label: 'Slug' },
      { key: 'starters', label: 'Starters', render: (r) => r.starters?.length || 0 },
      { key: 'premium', label: 'Plan', render: (r) => (r.premium ? <Badge tone="dark">Premium</Badge> : <Badge tone="gray">Free</Badge>) },
      { key: 'active', label: 'Active', render: (r) => (r.active ? 'Yes' : 'No') },
    ],
    fields: [
      ['title', 'Title', 'text'],
      ['slug', 'Slug (lowercase, dashes)', 'text'],
      ['icon', 'Icon (emoji)', 'text'],
      ['description', 'Description', 'text'],
      ['starters', 'Conversation starters (one per line)', 'lines'],
      ['order', 'Sort order', 'number'],
      ['premium', 'Premium topic', 'bool'],
      ['active', 'Active', 'bool'],
    ],
  },
  vocabulary: {
    label: 'Vocabulary and phrases',
    blank: { kind: 'word', word: '', meaning: '', example: '', level: 'beginner', topicSlug: '', active: true },
    columns: [
      { key: 'kind', label: 'Type', render: (r) => <Badge tone={r.kind === 'word' ? 'green' : r.kind === 'phrase' ? 'blue' : 'amber'}>{r.kind}</Badge> },
      { key: 'word', label: 'Text', render: (r) => <b>{r.word}</b> },
      { key: 'meaning', label: 'Meaning', render: (r) => <span className="line-clamp-1 max-w-[260px]">{r.meaning}</span> },
      { key: 'level', label: 'Level', render: (r) => (r.kind === 'word' ? r.level : '-') },
      { key: 'topicSlug', label: 'Topic', render: (r) => r.topicSlug || 'any' },
    ],
    fields: [
      ['kind', 'Type', 'select', [{ value: 'word', label: 'Vocabulary word' }, { value: 'phrase', label: 'Useful sentence' }, { value: 'starter', label: 'Conversation starter' }]],
      ['word', 'Word / sentence', 'text'],
      ['meaning', 'Meaning / note', 'text'],
      ['example', 'Example sentence', 'text'],
      ['level', 'Level', 'select', LEVEL_OPTS],
      ['topicSlug', 'Topic slug (blank = any topic)', 'text'],
      ['active', 'Active', 'bool'],
    ],
  },
  resources: {
    label: 'Learning resources',
    blank: { title: '', description: '', url: 'https://', category: 'General', active: true, order: 0 },
    columns: [
      { key: 'title', label: 'Title', render: (r) => <b>{r.title}</b> },
      { key: 'category', label: 'Category' },
      { key: 'url', label: 'URL', render: (r) => <span className="line-clamp-1 max-w-[240px] text-xs">{r.url}</span> },
      { key: 'active', label: 'Active', render: (r) => (r.active ? 'Yes' : 'No') },
    ],
    fields: [
      ['title', 'Title', 'text'],
      ['description', 'Description', 'text'],
      ['url', 'Link (https://...)', 'text'],
      ['category', 'Category', 'text'],
      ['order', 'Sort order', 'number'],
      ['active', 'Active', 'bool'],
    ],
  },
  faqs: {
    label: 'FAQs',
    blank: { question: '', answer: '', active: true, order: 0 },
    columns: [
      { key: 'question', label: 'Question', render: (r) => <b>{r.question}</b> },
      { key: 'answer', label: 'Answer', render: (r) => <span className="line-clamp-1 max-w-[320px]">{r.answer}</span> },
      { key: 'active', label: 'Active', render: (r) => (r.active ? 'Yes' : 'No') },
    ],
    fields: [
      ['question', 'Question', 'text'],
      ['answer', 'Answer', 'area'],
      ['order', 'Sort order', 'number'],
      ['active', 'Active', 'bool'],
    ],
  },
};

function Editor({ type, item, onClose, onSaved }) {
  const cfg = TYPES[type];
  const toast = useAppStore((s) => s.toast);
  const [form, setForm] = useState({ ...cfg.blank, ...item });
  const [busy, setBusy] = useState(false);
  const isNew = !item?.id;

  const save = async () => {
    setBusy(true);
    const body = { ...form };
    delete body.id;
    delete body.createdAt;
    delete body.updatedAt;
    if (type === 'vocabulary') body.topicSlug = body.topicSlug ? body.topicSlug : null;
    try {
      if (isNew) await adminApi.post(`/content/${type}`, body);
      else await adminApi.put(`/content/${type}/${item.id}`, body);
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
    <Sheet open onClose={onClose} title={`${isNew ? 'Add' : 'Edit'} ${cfg.label.toLowerCase()}`}>
      <div className="space-y-4">
        {cfg.fields.map(([key, label, kind, opts]) => (
          <div key={key}>
            {kind === 'bool' ? (
              <div className="flex items-center justify-between rounded-2xl bg-light px-4 py-3">
                <span className="text-sm font-bold">{label}</span>
                <Toggle checked={Boolean(form[key])} onChange={(v) => setForm({ ...form, [key]: v })} label={label} />
              </div>
            ) : (
              <Field label={label}>
                {kind === 'select' ? (
                  <Select value={form[key]} onChange={(v) => setForm({ ...form, [key]: v })} options={opts} />
                ) : kind === 'area' ? (
                  <textarea className="input resize-none" rows={4} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                ) : kind === 'lines' ? (
                  <textarea className="input resize-none" rows={5} value={(form[key] || []).join('\n')} onChange={(e) => setForm({ ...form, [key]: e.target.value.split('\n').filter((l) => l.trim()) })} />
                ) : kind === 'number' ? (
                  <input type="number" min={0} className="input" value={form[key] ?? 0} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} />
                ) : (
                  <input className="input" value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                )}
              </Field>
            )}
          </div>
        ))}
        <Button className="btn-primary w-full" loading={busy} onClick={save}>
          {isNew ? 'Add' : 'Save changes'}
        </Button>
      </div>
    </Sheet>
  );
}

export default function AdminContent() {
  const toast = useAppStore((s) => s.toast);
  const [type, setType] = useState('topics');
  const [editing, setEditing] = useState(null); // item or {} for new
  const [deleting, setDeleting] = useState(null);
  const { data, loading, reload } = useFetch(() => adminApi.get(`/content/${type}`).then((r) => r.data.items), [type]);
  const cfg = TYPES[type];

  const remove = async () => {
    try {
      await adminApi.delete(`/content/${type}/${deleting.id}`);
      toast('Deleted', 'success');
      reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageTitle title="Content management" subtitle="Topics, vocabulary, learning resources and FAQs shown in the app.">
        <Button className="btn-primary btn-sm" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </PageTitle>
      <Tabs tabs={Object.entries(TYPES).map(([k, v]) => [k, v.label])} value={type} onChange={setType} />
      <DataTable
        loading={loading}
        rows={data}
        empty="Nothing here yet"
        columns={[
          ...cfg.columns,
          {
            key: 'act',
            label: '',
            render: (r) => (
              <div className="flex justify-end gap-1.5">
                <button className="rounded-full bg-primary/20 p-2 text-secondary" onClick={() => setEditing(r)} aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="rounded-full bg-red-50 p-2 text-red-600" onClick={() => setDeleting(r)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ),
          },
        ]}
      />
      {editing && <Editor key={editing.id || 'new'} type={type} item={editing} onClose={() => setEditing(null)} onSaved={reload} />}
      <ConfirmSheet open={Boolean(deleting)} title="Delete this item?" text="It will disappear from the app immediately." confirmLabel="Delete" danger onConfirm={remove} onClose={() => setDeleting(null)} />
    </>
  );
}
