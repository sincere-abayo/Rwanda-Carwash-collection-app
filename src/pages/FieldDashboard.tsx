import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/client';
import { useAuthStore } from '../store/useAuthStore';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { Plus, Droplets, MapPin, CheckCircle, Clock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export function FieldDashboard() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get recent carwashes, prioritizing pending ones
  const recentCarwashes = useLiveQuery(
    () => db.carwashes
      .orderBy('updated_at')
      .reverse()
      .limit(10)
      .toArray()
  );

  const stats = useLiveQuery(async () => {
    const total = await db.carwashes.count();
    const pending = await db.carwashes.where('sync_status').equals('PENDING').count();
    const carwashes = await db.carwashes.toArray();
    
    const regions = {
      kigali: carwashes.filter(c => c.province?.toLowerCase().includes('kigali')).length,
      northern: carwashes.filter(c => c.province?.toLowerCase().includes('north')).length,
      southern: carwashes.filter(c => c.province?.toLowerCase().includes('south')).length,
      eastern: carwashes.filter(c => c.province?.toLowerCase().includes('east')).length,
      western: carwashes.filter(c => c.province?.toLowerCase().includes('west')).length,
    };

    return { total, pending, regions };
  }, [], { total: 0, pending: 0, regions: { kigali: 0, northern: 0, southern: 0, eastern: 0, western: 0 } });

  return (
    <div className="flex-1 bg-background pb-32">
      {/* Header */}
      <header className="bg-brand-dark text-white pt-12 pb-6 px-4 rounded-b-[32px] shadow-lg sticky top-0 z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-brand-info font-medium text-sm mb-1">Good morning,</p>
            <h1 className="text-2xl font-bold">{user?.name} 👋</h1>
          </div>
          <button onClick={handleLogout} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-colors">
            <LogOut className="w-5 h-5 text-white" />
          </button>
        </div>
        <SyncStatusIndicator />
      </header>

      {/* Main Content */}
      <main className="px-4 pt-6 max-w-lg mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-surface p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group">
            <div className="absolute -right-2 -top-2 opacity-[0.03] text-brand-primary group-hover:opacity-[0.06] transition-opacity">
              <MapPin className="w-20 h-20" />
            </div>
            <p className="text-slate-500 text-sm font-medium mb-1 relative flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Registered
            </p>
            <p className="text-4xl font-bold text-slate-900 tracking-tight relative">{stats.total}</p>
          </div>
          
          <div className={`p-5 rounded-3xl shadow-sm relative overflow-hidden group ${stats.pending > 0 ? 'bg-brand-warning/10 border border-brand-warning/20' : 'bg-surface border border-slate-100'}`}>
            <div className={`absolute -right-2 -top-2 opacity-[0.03] transition-opacity group-hover:opacity-[0.06] ${stats.pending > 0 ? 'text-brand-warning' : 'text-slate-900'}`}>
              <Clock className="w-20 h-20" />
            </div>
            <p className={`text-sm font-medium mb-1 relative flex items-center gap-1.5 ${stats.pending > 0 ? 'text-brand-warning' : 'text-slate-500'}`}>
              <Clock className="w-3.5 h-3.5" /> Pending Sync
            </p>
            <p className={`text-4xl font-bold tracking-tight relative ${stats.pending > 0 ? 'text-brand-warning' : 'text-slate-900'}`}>{stats.pending}</p>
          </div>
        </div>

        {/* Geographic Distribution Card */}
        <section className="bg-surface p-5 rounded-3xl shadow-sm border border-slate-100 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-primary" />
              Geographic Distribution
            </h2>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              5 Provinces
            </span>
          </div>

          <div className="space-y-3.5">
            {[
              { label: "Kigali City", value: stats?.regions?.kigali || 0 },
              { label: "Northern Province", value: stats?.regions?.northern || 0 },
              { label: "Southern Province", value: stats?.regions?.southern || 0 },
              { label: "Eastern Province", value: stats?.regions?.eastern || 0 },
              { label: "Western Province", value: stats?.regions?.western || 0 },
            ].map((region) => {
              const percentage = stats.total > 0 ? Math.round((region.value / stats.total) * 100) : 0;
              return (
                <div key={region.label} className="group">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-slate-700 font-medium">{region.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{region.value}</span>
                      <span className="text-[10px] text-slate-400 font-medium">({percentage}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-brand-primary h-2 rounded-full transition-all duration-700 ease-out group-hover:bg-blue-700"
                      style={{ width: `${Math.max(percentage, region.value > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="flex justify-between items-end mb-4">
          <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
          <button onClick={() => navigate('/registry')} className="text-brand-primary text-sm font-semibold hover:underline">View All</button>
        </div>

        {/* List */}
        <div className="space-y-3">
          {recentCarwashes?.map(cw => (
            <div 
              key={cw.id} 
              onClick={() => navigate('/registry')}
              className="bg-surface p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-4 items-center cursor-pointer transition-transform active:scale-[0.98] hover:border-brand-primary"
            >
              <div className="w-12 h-12 rounded-xl bg-brand-primary/10 text-brand-primary flex flex-shrink-0 items-center justify-center">
                <Droplets className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">{cw.name || 'Unnamed Carwash'}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                  <MapPin className="w-3 h-3 flex-shrink-0" /> {cw.sector}, {cw.district}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {cw.sync_status === 'SYNCED' ? (
                  <CheckCircle className="w-4 h-4 text-brand-success" />
                ) : (
                  <Clock className="w-4 h-4 text-brand-warning" />
                )}
                <span className="text-[10px] text-slate-400 font-medium">
                  {format(new Date(cw.updated_at), 'MMM d')}
                </span>
              </div>
            </div>
          ))}
          {recentCarwashes?.length === 0 && (
            <div className="text-center py-8 bg-surface rounded-2xl border border-slate-100 border-dashed">
              <Droplets className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No registrations yet.</p>
            </div>
          )}
        </div>
      </main>

      {/* FAB - Floating Action Button */}
      <div className="fixed bottom-24 left-0 right-0 md:left-64 md:bottom-8 px-4 max-w-lg mx-auto z-20">
        <button
          onClick={() => navigate('/register')}
          className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors active:scale-[0.98]"
        >
          <Plus className="w-6 h-6" />
          Register Carwash
        </button>
      </div>
    </div>
  );
}
