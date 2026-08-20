import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/client';
import { 
  ArrowLeft, Search, Droplets, MapPin, CheckCircle, Clock, 
  Edit2, Trash2, Plus, ExternalLink, Filter, LayoutGrid, Table, 
  Phone, User, Check, X, ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { RWANDA_HIERARCHY } from '../lib/location-data';
import { performSync } from '../hooks/useSyncEngine';

export function Registry() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const user = useAuthStore(state => state.user);
  const isStaff = user?.role === 'staff' || (user?.role as string) === 'field_officer';

  const carwashes = useLiveQuery(
    () => db.carwashes
      .orderBy('updated_at')
      .reverse()
      .filter(cw => {
        if (provinceFilter && cw.province !== provinceFilter) return false;
        if (districtFilter && cw.district !== districtFilter) return false;
        if (statusFilter !== 'all' && cw.verification_status !== statusFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (cw.name || '').toLowerCase().includes(q) || 
               cw.sector.toLowerCase().includes(q) || 
               cw.district.toLowerCase().includes(q) ||
               (cw.contact_name || '').toLowerCase().includes(q) ||
               (cw.phone || '').toLowerCase().includes(q) ||
               (cw.address || '').toLowerCase().includes(q);
      })
      .toArray(),
    [search, provinceFilter, districtFilter, statusFilter]
  );

  const stats = useLiveQuery(
    async () => {
      const all = await db.carwashes.toArray();
      const verified = all.filter(c => c.verification_status === 'verified').length;
      const pending = all.filter(c => c.sync_status === 'PENDING').length;
      return { total: all.length, verified, pending };
    },
    [],
    { total: 0, verified: 0, pending: 0 }
  );

  const handleDelete = async (id: string, name?: string) => {
    if (window.confirm(`Are you sure you want to remove "${name || 'this carwash'}"?`)) {
      await db.sync_queue.add({
        id: crypto.randomUUID(),
        type: 'delete_carwash',
        payload: { id },
        created_at: new Date().toISOString()
      });
      await db.carwashes.delete(id);
      performSync().catch(err => console.warn('Background sync on delete:', err));
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      {/* ================= MOBILE HEADER (< md) ================= */}
      <header className={`md:hidden px-4 h-14 flex items-center justify-between sticky top-0 z-20 ${
        isStaff ? 'bg-white border-b border-slate-100' : 'bg-[#0B3B8F] text-white shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <button 
            id="mobile-back-btn"
            onClick={() => navigate(-1)} 
            className={`p-2 -ml-2 rounded-full ${isStaff ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-white'}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base">Carwashes Directory</h1>
        </div>
        <button
          id="mobile-header-add-btn"
          onClick={() => navigate('/register')}
          className={`p-2 rounded-xl flex items-center gap-1 font-semibold text-xs ${
            isStaff ? 'bg-blue-50 text-blue-600' : 'bg-white/10 text-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </header>

      {/* ================= DESKTOP HEADER (>= md) ================= */}
      <header className="hidden md:block bg-surface border-b border-slate-200/80 px-8 py-6 sticky top-0 z-20 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">National Carwash Registry</h1>
              <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200/60">
                {carwashes?.length || 0} Registered
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              Comprehensive registry of verified vehicle washing facilities across Rwanda
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-slate-600">
              <button
                id="view-mode-table"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'hover:text-slate-900'
                }`}
                title="Table View"
              >
                <Table className="w-4 h-4" />
                <span className="hidden lg:inline">Table</span>
              </button>
              <button
                id="view-mode-grid"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm font-bold' : 'hover:text-slate-900'
                }`}
                title="Grid Cards"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden lg:inline">Grid</span>
              </button>
            </div>

            <button
              id="desktop-register-cw-btn"
              onClick={() => navigate('/register')}
              className="bg-brand-primary hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Carwash</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="px-4 py-5 md:px-8 md:py-8 w-full max-w-7xl mx-auto flex-1 flex flex-col">
        
        {/* Desktop Quick Stats Bar */}
        <div className="hidden md:grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total in Database</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Droplets className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-surface p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Verified on Site</p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">{stats.verified}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-surface p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Cloud Sync</p>
              <p className="text-2xl font-black text-amber-600 mt-0.5">{stats.pending}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters and Search Toolbar */}
        <div className="bg-surface p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="registry-search-input"
              type="text"
              placeholder="Search by name, district, sector, contact, or address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 placeholder-slate-400"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Location cascading filters */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <select
              id="registry-filter-province"
              value={provinceFilter}
              onChange={(e) => {
                setProvinceFilter(e.target.value);
                setDistrictFilter('');
              }}
              className="flex-1 sm:w-44 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Provinces</option>
              {Object.keys(RWANDA_HIERARCHY).map(prov => (
                <option key={prov} value={prov}>{prov.replace(' Province', '')}</option>
              ))}
            </select>

            <select
              id="registry-filter-district"
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              disabled={!provinceFilter}
              className="flex-1 sm:w-44 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Districts</option>
              {provinceFilter && Object.keys(RWANDA_HIERARCHY[provinceFilter as keyof typeof RWANDA_HIERARCHY] || {}).map(dist => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>

            <select
              id="registry-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full sm:w-36 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-xs sm:text-sm font-bold text-slate-700">
            Showing <span className="text-blue-600">{carwashes?.length || 0}</span> carwashes
          </p>
          {(provinceFilter || districtFilter || statusFilter !== 'all' || search) && (
            <button
              onClick={() => {
                setProvinceFilter('');
                setDistrictFilter('');
                setStatusFilter('all');
                setSearch('');
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* ================= DESKTOP TABLE VIEW (>= md when viewMode === 'table') ================= */}
        <div className="hidden md:block">
          {viewMode === 'table' ? (
            <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Carwash Facility</th>
                      <th className="py-3.5 px-4">Location (Rwanda)</th>
                      <th className="py-3.5 px-4">Contact</th>
                      <th className="py-3.5 px-4">GPS / Coordinates</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Sync</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {carwashes?.map(cw => (
                      <tr key={cw.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
                              <Droplets className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900">{cw.name || 'Unnamed Facility'}</p>
                              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[180px]">
                                ID: {cw.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <p className="font-semibold text-slate-800 text-xs">
                            {cw.province?.replace(' Province', '')} &bull; {cw.district}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Sector: <span className="font-medium text-slate-700">{cw.sector}</span>
                          </p>
                          {cw.address && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[200px] mt-0.5">
                              {cw.address}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <p className="text-xs font-semibold text-slate-800">{cw.contact_name || '—'}</p>
                          {cw.phone ? (
                            <a href={`tel:${cw.phone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3" /> {cw.phone}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">No phone</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          {cw.lat && cw.lng ? (
                            <a 
                              href={`https://maps.google.com/?q=${cw.lat},${cw.lng}`} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-mono text-xs border border-slate-200 transition-colors"
                            >
                              <MapPin className="w-3 h-3 text-red-500" />
                              <span>{cw.lat.toFixed(4)}, {cw.lng.toFixed(4)}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No GPS</span>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                            cw.verification_status === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {cw.verification_status === 'verified' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {cw.verification_status === 'verified' ? 'Verified' : 'Pending'}
                          </span>
                        </td>

                        <td className="py-4 px-4">
                          {cw.sync_status === 'SYNCED' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                              <CheckCircle className="w-3.5 h-3.5" /> Synced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                              <Clock className="w-3.5 h-3.5" /> Local
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              id={`edit-btn-${cw.id}`}
                              onClick={() => navigate(`/register?edit=${cw.id}`)}
                              className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit Carwash"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {(user?.role === 'admin' || cw.created_by === user?.id) && (
                              <button
                                id={`delete-btn-${cw.id}`}
                                onClick={() => handleDelete(cw.id, cw.name)}
                                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete Carwash"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Desktop Grid Mode */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {carwashes?.map(cw => (
                <div key={cw.id} className="bg-surface rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base leading-tight">{cw.name || 'Unnamed Facility'}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{cw.province} &bull; {cw.district}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        cw.verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {cw.verification_status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-4">
                      <p><span className="font-semibold text-slate-700">Sector:</span> {cw.sector}</p>
                      {cw.address && <p><span className="font-semibold text-slate-700">Address:</span> {cw.address}</p>}
                      <p><span className="font-semibold text-slate-700">Contact:</span> {cw.contact_name || 'N/A'} {cw.phone ? `(${cw.phone})` : ''}</p>
                      {cw.lat && cw.lng && (
                        <p className="flex items-center justify-between">
                          <span><span className="font-semibold text-slate-700">GPS:</span> {cw.lat.toFixed(4)}, {cw.lng.toFixed(4)}</span>
                          <a href={`https://maps.google.com/?q=${cw.lat},${cw.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold hover:underline">View Map</a>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {format(new Date(cw.updated_at), 'MMM d, yyyy')}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/register?edit=${cw.id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition-colors flex items-center gap-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      {(user?.role === 'admin' || cw.created_by === user?.id) && (
                        <button
                          onClick={() => handleDelete(cw.id, cw.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= MOBILE CARD FEED (< md) ================= */}
        <div className="md:hidden space-y-4">
          {carwashes?.map(cw => (
            <div 
              key={cw.id} 
              className={`p-4 rounded-2xl flex flex-col gap-3.5 bg-surface border border-slate-200/80 shadow-sm`}
            >
              <div className="flex gap-3.5 items-center">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex flex-shrink-0 items-center justify-center">
                  <Droplets className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">{cw.name || 'Unnamed Carwash'}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      cw.verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {cw.verification_status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                    <span className="text-xs text-slate-500 truncate">{cw.district}, {cw.sector}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {cw.sync_status === 'SYNCED' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(cw.updated_at), 'MMM d')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1.5 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                <p><span className="font-semibold text-slate-800">Location:</span> {cw.province} • {cw.district} • {cw.sector}</p>
                {cw.address && <p><span className="font-semibold text-slate-800">Address:</span> {cw.address}</p>}
                <p><span className="font-semibold text-slate-800">Contact:</span> {cw.contact_name || 'N/A'} {cw.phone ? `(${cw.phone})` : ''}</p>
                {cw.lat && cw.lng && (
                  <p className="flex items-center justify-between">
                    <span><span className="font-semibold text-slate-800">GPS:</span> {cw.lat.toFixed(4)}, {cw.lng.toFixed(4)}</span>
                    <a href={`https://maps.google.com/?q=${cw.lat},${cw.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline">Map</a>
                  </p>
                )}
              </div>

              {(user?.role === 'admin' || cw.created_by === user?.id) && (
                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={() => navigate(`/register?edit=${cw.id}`)}
                    className="flex-1 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex justify-center items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(cw.id, cw.name)}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-red-50 text-red-600 border border-red-200/60 flex justify-center items-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Empty State */}
        {carwashes?.length === 0 && (
          <div className="text-center py-16 px-4 bg-surface rounded-3xl border border-dashed border-slate-200 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-4">
              <Droplets className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No Carwashes Found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
              {search || provinceFilter || districtFilter 
                ? 'Try adjusting your search criteria or clear location filters.' 
                : 'No carwash facilities have been registered in this database yet.'}
            </p>
            <button
              onClick={() => navigate('/register')}
              className="bg-brand-primary hover:bg-brand-dark text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Carwash</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

