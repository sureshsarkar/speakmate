import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import Avatar from './Avatar';
import { Spinner } from './ui';
import { api, errMsg } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

/** Profile-picture picker. Only rendered when the server has Cloudinary configured. */
export function AvatarUploader({ size = 96 }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useAppStore((s) => s.toast);
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast('Image is too large (max 2 MB).', 'error');
    const fd = new FormData();
    fd.append('avatar', file);
    setBusy(true);
    try {
      const { data } = await api.post('/profile/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser(data.user);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { data } = await api.delete('/profile/avatar');
      setUser(data.user);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar src={user?.avatarUrl} name={user?.displayName} size={size} />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
            <Spinner />
          </div>
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-secondary shadow-glow"
          aria-label="Change profile picture"
        >
          <ImagePlus className="h-[18px] w-[18px]" />
        </button>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {user?.avatarUrl && (
        <button type="button" onClick={remove} className="flex items-center gap-1 text-xs font-semibold text-ink/50 hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" /> Remove photo
        </button>
      )}
    </div>
  );
}
