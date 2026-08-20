import { Home, List, Users, Plus, LogOut, ShieldCheck, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/client';

export function BottomNav() {
  const { user, logout } = useAuthStore();
  const { isOnline, isSyncing, pendingCount } = useSyncStore();
  const { triggerSync } = useSyncEngine();
  const navigate = useNavigate();
  const location = useLocation();

  const totalCarwashes = useLiveQuery(() => db.carwashes.count(), [], 0);

  const isStaff = user?.role === 'staff' || (user?.role as string) === 'field_officer';
  const baseRoute = isStaff ? '/field' : '/admin';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navBgClass = isStaff ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-[#0B3B8F] border-blue-900/50 text-blue-200';
  const activeColor = isStaff ? 'text-white' : 'text-white';
  const activeBg = isStaff ? 'bg-blue-600 text-white shadow-md' : 'bg-white/15 text-white shadow-md';
  const inactiveHover = isStaff ? 'hover:bg-slate-800/80 hover:text-slate-200' : 'hover:bg-white/10 hover:text-white';

  return (
    <>
      {/* ================= DESKTOP / TABLET SIDEBAR (>= md) ================= */}
      <aside className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 w-64 lg:w-72 h-dvh z-40 border-r ${navBgClass} p-5 justify-between select-none shadow-2xl`}>
        {/* Brand Header */}
        <div>
          <div className="flex items-center gap-3 pb-6 border-b border-white/10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-emerald-400 p-0.5 shadow-lg flex items-center justify-center flex-shrink-0">
              <div className="w-full h-full bg-[#0B3B8F] rounded-[14px] flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-black text-xl text-white tracking-tight">CYESHA</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                  RWA
                </span>
              </div>
              <p className="text-xs text-blue-200/80 truncate">
                {isStaff ? 'Field Officer Portal' : 'National Admin Portal'}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 px-3 mb-2">Navigation</p>
            <nav className="space-y-1.5">
              <button
                id="nav-btn-home"
                onClick={() => navigate(baseRoute)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === baseRoute ? activeBg : inactiveHover
                }`}
              >
                <div className="flex items-center gap-3">
                  <Home className="w-4 h-4 flex-shrink-0" />
                  <span>Dashboard</span>
                </div>
              </button>

              <button
                id="nav-btn-carwashes"
                onClick={() => navigate('/registry')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === '/registry' ? activeBg : inactiveHover
                }`}
              >
                <div className="flex items-center gap-3">
                  <List className="w-4 h-4 flex-shrink-0" />
                  <span>Carwashes</span>
                </div>
                {totalCarwashes > 0 && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                    {totalCarwashes}
                  </span>
                )}
              </button>

              <button
                id="nav-btn-register"
                onClick={() => navigate('/register')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  location.pathname === '/register' ? activeBg : inactiveHover
                }`}
              >
                <div className="flex items-center gap-3">
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span>Register Carwash</span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                  New
                </span>
              </button>

              {!isStaff && (
                <button
                  id="nav-btn-staff"
                  onClick={() => navigate('/admin/users')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    location.pathname === '/admin/users' ? activeBg : inactiveHover
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 flex-shrink-0" />
                    <span>Staff Management</span>
                  </div>
                </button>
              )}
            </nav>
          </div>
        </div>

        {/* Sidebar Bottom: Sync Widget & User Card */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          {/* Sync Box */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 font-medium">Sync Status</span>
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                  <Cloud className="w-3.5 h-3.5" /> Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 font-semibold text-[11px]">
                  <CloudOff className="w-3.5 h-3.5" /> Offline
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-white/80 mb-2.5">
              <span>Local Queue:</span>
              <span className="font-mono font-bold bg-white/10 px-1.5 py-0.5 rounded text-white">
                {pendingCount} pending
              </span>
            </div>

            <button
              id="sidebar-sync-trigger"
              onClick={triggerSync}
              disabled={isSyncing}
              className="w-full py-1.5 px-3 bg-white/10 hover:bg-white/20 active:scale-[0.98] transition-all rounded-lg text-white font-medium flex items-center justify-center gap-1.5 text-xs border border-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Synchronizing...' : 'Sync Now'}
            </button>
          </div>

          {/* User Profile Card */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-md flex-shrink-0">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name}</p>
                <p className="text-[11px] text-white/50 truncate capitalize">
                  {user?.role === 'admin' ? 'System Administrator' : 'Field Officer'}
                </p>
              </div>
            </div>
            <button
              id="sidebar-logout-btn"
              onClick={handleLogout}
              title="Sign out"
              className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MOBILE BOTTOM NAVIGATION (< md) ================= */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 h-16 backdrop-blur-xl border-t z-50 px-4 pb-[max(env(safe-area-inset-bottom),8px)] pt-1 flex justify-around items-center ${
        isStaff ? 'bg-white/95 border-slate-200 text-slate-500 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]' : 'bg-[#0B3B8F]/95 border-white/10 text-blue-200 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]'
      }`}>
        <button
          id="mobile-nav-home"
          onClick={() => navigate(baseRoute)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            location.pathname === baseRoute
              ? (isStaff ? 'text-blue-600 font-bold scale-105' : 'text-white font-bold scale-105')
              : (isStaff ? 'text-slate-400 hover:text-slate-600' : 'text-blue-200/60 hover:text-white')
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-wide">Home</span>
        </button>

        <button
          id="mobile-nav-carwashes"
          onClick={() => navigate('/registry')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            location.pathname === '/registry'
              ? (isStaff ? 'text-blue-600 font-bold scale-105' : 'text-white font-bold scale-105')
              : (isStaff ? 'text-slate-400 hover:text-slate-600' : 'text-blue-200/60 hover:text-white')
          }`}
        >
          <List className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-wide">Carwashes</span>
        </button>

        <button
          id="mobile-nav-register"
          onClick={() => navigate('/register')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            location.pathname === '/register'
              ? (isStaff ? 'text-blue-600 font-bold scale-105' : 'text-white font-bold scale-105')
              : (isStaff ? 'text-slate-400 hover:text-slate-600' : 'text-blue-200/60 hover:text-white')
          }`}
        >
          <Plus className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 tracking-wide">Register</span>
        </button>

        {!isStaff && (
          <button
            id="mobile-nav-staff"
            onClick={() => navigate('/admin/users')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              location.pathname === '/admin/users'
                ? 'text-white font-bold scale-105'
                : 'text-blue-200/60 hover:text-white'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-wide">Staff</span>
          </button>
        )}
      </nav>
    </>
  );
}

