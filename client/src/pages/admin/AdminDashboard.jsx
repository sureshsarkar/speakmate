import { Activity, Clock, Flag, Headphones, PhoneCall, Radio, Search, UserCheck, UserRound, Users } from 'lucide-react';
import { BarChart, Skeleton } from '../../components/ui';
import { useFetch } from '../../hooks';
import { adminApi } from '../../lib/adminApi';
import { PageTitle, StatCard } from './AdminUI';

export default function AdminDashboard() {
  const { data, loading } = useFetch(() => adminApi.get('/dashboard').then((r) => r.data), [], { interval: 5000 });
  const s = data?.stats;

  return (
    <>
      <PageTitle title="Dashboard" subtitle="Live overview. Refreshes every 5 seconds." />
      {loading && !s ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <StatCard icon={Users} label="Registered users" value={s.registeredUsers} />
            <StatCard icon={UserRound} label="Guest users" value={s.guestUsers} tone="bg-sky-100 text-sky-700" />
            <StatCard icon={Radio} label="Online users" value={s.onlineUsers} tone="bg-emerald-100 text-emerald-700" />
            <StatCard icon={Search} label="Currently searching" value={s.searching} tone="bg-amber-100 text-amber-700" />
            <StatCard icon={Headphones} label="Active audio calls" value={s.activeCalls} tone="bg-violet-100 text-violet-700" />
            <StatCard icon={PhoneCall} label="Total calls" value={s.totalCalls} />
            <StatCard icon={Clock} label="Total speaking minutes" value={s.totalSpeakingMinutes} tone="bg-sky-100 text-sky-700" />
            <StatCard icon={Flag} label="Open reports" value={s.openReports} tone="bg-red-100 text-red-700" sub={`${s.restrictedUsers} restricted users`} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <section className="card">
              <h2 className="mb-3 flex items-center gap-2 font-extrabold text-secondary">
                <UserCheck className="h-5 w-5" /> Daily registrations (14 days)
              </h2>
              <BarChart data={data.dailyRegistrations.map((d) => ({ ...d, label: d.day.slice(8) }))} valueKey="users" unit="" height={150} />
            </section>
            <section className="card">
              <h2 className="mb-3 flex items-center gap-2 font-extrabold text-secondary">
                <Activity className="h-5 w-5" /> Daily guest sessions (14 days)
              </h2>
              <BarChart data={data.dailyRegistrations.map((d) => ({ ...d, label: d.day.slice(8) }))} valueKey="guests" unit="" height={150} />
            </section>
          </div>
        </>
      )}
    </>
  );
}
