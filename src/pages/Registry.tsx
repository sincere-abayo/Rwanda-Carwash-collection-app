import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/client';
import { 
  ArrowLeft, Search, Droplets, MapPin, CheckCircle, Clock, 
  Edit2, Trash2, Plus, ExternalLink, Filter, LayoutGrid, Table, 
  Phone, User, Check, X, ShieldCheck, Calendar, FileText, FileSpreadsheet, Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/useAuthStore';
import { getProvinces, getDistricts, getSectors, getCells } from '../lib/location-data';
import { performSync, deleteCarwashOnServer } from '../hooks/useSyncEngine';
import { generateId, formatCarwashDisplay } from '../lib/utils';
import { exportNationalExcelReport, exportNationalPdfReport } from '../lib/reports';
import { useSyncStore } from '../store/useSyncStore';

function registrationToIso(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Registry() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [cellFilter, setCellFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDate, setBulkDate] = useState(todayLocalISO());
  const [isApplyingDate, setIsApplyingDate] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const user = useAuthStore(state => state.user);
  const isStaff = user?.role === 'staff' || (user?.role as string) === 'field_officer';
  const isOnline = useSyncStore((s) => s.isOnline);

  const carwashes = useLiveQuery(
    () => db.carwashes
      .orderBy('updated_at')
      .reverse()
      .filter(cw => {
        if (provinceFilter && cw.province !== provinceFilter) return false;
        if (districtFilter && cw.district !== districtFilter) return false;
        if (sectorFilter && (cw.sector || '') !== sectorFilter) return false;
        if (cellFilter && (cw.cell || '') !== cellFilter) return false;
        if (statusFilter !== 'all' && cw.verification_status !== statusFilter) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (cw.name || '').toLowerCase().includes(q) || 
               (cw.sector || '').toLowerCase().includes(q) ||
               (cw.cell || '').toLowerCase().includes(q) ||
               cw.district.toLowerCase().includes(q) ||
               (cw.contact_name || '').toLowerCase().includes(q) ||
               (cw.phone || '').toLowerCase().includes(q) ||
               (cw.address || '').toLowerCase().includes(q);
      })
      .toArray(),
    [search, provinceFilter, districtFilter, sectorFilter, cellFilter, statusFilter]
  );

  const visibleIds = useMemo(() => (carwashes || []).map((c) => c.id), [carwashes]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(type);
    try {
      const all = (await db.carwashes.toArray()) || [];
      const regions = {
        kigali: all.filter((c) => c.province === 'Kigali City').length,
        northern: all.filter((c) => c.province === 'Northern Province').length,
        southern: all.filter((c) => c.province === 'Southern Province').length,
        eastern: all.filter((c) => c.province === 'Eastern Province').length,
        western: all.filter((c) => c.province === 'Western Province').length,
      };
      const payload = {
        stats: {
          total: all.length,
          verified: all.filter((c) => c.verification_status === 'verified').length,
          unverified: all.filter((c) => c.verification_status !== 'verified').length,
          active: all.filter((c) => c.status === 'active').length,
          regions,
        },
        carwashes: all,
        generatedBy: user?.name || user?.username || 'User',
      };
      if (type === 'pdf') await exportNationalPdfReport(payload);
      else await exportNationalExcelReport(payload);
    } catch (err) {
      console.error(err);
      alert('Failed to generate report.');
    } finally {
      setExporting(null);
    }
  };

  const handleBulkSetDate = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkDate) {
      alert('Please choose a registration date.');
      return;
    }

    setIsApplyingDate(true);
    try {
      const now = new Date().toISOString();
      const regIso = registrationToIso(bulkDate);
      const regMs = new Date(regIso).getTime();
      const ids = Array.from(selectedIds);

      await db.transaction('rw', db.carwashes, db.sync_queue, async () => {
        for (const id of ids) {
          const existing = await db.carwashes.get(id);
          if (!existing) continue;
          const updated = {
            ...existing,
            registration_date: regIso,
            updated_at: now,
            sync_status: 'PENDING' as const,
          };
          await db.carwashes.put(updated);
          await db.sync_queue.add({
            id: generateId(),
            type: 'upsert_carwash',
            payload: {
              ...updated,
              registration_date: regMs,
              isNew: false,
            },
            created_at: now,
          });
        }
      });

      performSync().catch((err) => console.warn('Background sync on bulk date:', err));
      clearSelection();
    } catch (err) {
      console.error(err);
      alert('Failed to update registration dates.');
    } finally {
      setIsApplyingDate(false);
    }
  };

  const handleDelete = async (id: string, name?: string) => {
    if (!isOnline) {
      alert('Connect to the internet to delete. Deletes run on the server so every device stays in sync.');
      return;
    }
    if (!window.confirm(`Remove "${name || 'this carwash'}" from the national registry? This applies for all users.`)) {
      return;
    }
    try {
      await deleteCarwashOnServer(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert(err?.message || 'Delete failed');
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
              id="desktop-export-pdf-btn"
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50"
              title="Export PDF report"
            >
              {exporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span className="hidden lg:inline">PDF</span>
            </button>
            <button
              id="desktop-export-excel-btn"
              type="button"
              onClick={() => handleExport('excel')}
              disabled={!!exporting}
              className="px-3 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 bg-emerald-50 text-sm font-semibold hover:bg-emerald-100 flex items-center gap-1.5 disabled:opacity-50"
              title="Export Excel report"
            >
              {exporting === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              <span className="hidden lg:inline">Excel</span>
            </button>

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
      <main className={`px-4 py-5 md:px-8 md:py-8 w-full max-w-7xl mx-auto flex-1 flex flex-col ${
        selectedIds.size > 0 ? 'pb-28 md:pb-24' : ''
      }`}>
        
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
              placeholder="Search by facility, landmark, cell, district, sector, or contact..."
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
          <div className="flex flex-wrap gap-2">
            <select
              id="registry-filter-province"
              value={provinceFilter}
              onChange={(e) => {
                setProvinceFilter(e.target.value);
                setDistrictFilter('');
                setSectorFilter('');
                setCellFilter('');
              }}
              className="flex-1 min-w-[8.5rem] sm:w-40 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">All Provinces</option>
              {getProvinces().map((prov) => (
                <option key={prov} value={prov}>{prov.replace(' Province', '')}</option>
              ))}
            </select>

            <select
              id="registry-filter-district"
              value={districtFilter}
              onChange={(e) => {
                setDistrictFilter(e.target.value);
                setSectorFilter('');
                setCellFilter('');
              }}
              disabled={!provinceFilter}
              className="flex-1 min-w-[8.5rem] sm:w-40 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Districts</option>
              {getDistricts(provinceFilter).map((dist) => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>

            <select
              id="registry-filter-sector"
              value={sectorFilter}
              onChange={(e) => {
                setSectorFilter(e.target.value);
                setCellFilter('');
              }}
              disabled={!districtFilter}
              className="flex-1 min-w-[8.5rem] sm:w-40 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Sectors</option>
              {getSectors(provinceFilter, districtFilter).map((sec) => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>

            <select
              id="registry-filter-cell"
              value={cellFilter}
              onChange={(e) => setCellFilter(e.target.value)}
              disabled={!districtFilter}
              className="flex-1 min-w-[8.5rem] sm:w-40 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">All Cells</option>
              {getCells(provinceFilter, districtFilter, sectorFilter || undefined).map((cell) => (
                <option key={cell} value={cell}>{cell}</option>
              ))}
            </select>

            <select
              id="registry-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="flex-1 min-w-[8.5rem] sm:w-36 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-4 px-1 gap-3">
          <p className="text-xs sm:text-sm font-bold text-slate-700">
            Showing <span className="text-blue-600">{carwashes?.length || 0}</span> carwashes
            {selectedIds.size > 0 && (
              <span className="ml-2 text-blue-600 font-semibold">· {selectedIds.size} selected</span>
            )}
          </p>
          <div className="flex items-center gap-3">
            {visibleIds.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="text-xs font-semibold text-slate-600 hover:text-blue-700"
              >
                {allVisibleSelected ? 'Deselect all' : 'Select all'}
              </button>
            )}
            {(provinceFilter || districtFilter || sectorFilter || cellFilter || statusFilter !== 'all' || search) && (
              <button
                onClick={() => {
                  setProvinceFilter('');
                  setDistrictFilter('');
                  setSectorFilter('');
                  setCellFilter('');
                  setStatusFilter('all');
                  setSearch('');
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* ================= DESKTOP TABLE VIEW (>= md when viewMode === 'table') ================= */}
        <div className="hidden md:block">
          {viewMode === 'table' ? (
            <div className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 pl-4 pr-2 w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                          }}
                          onChange={toggleSelectAllVisible}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label="Select all"
                        />
                      </th>
                      <th className="py-3.5 px-5">Carwash Facility</th>
                      <th className="py-3.5 px-4">Location (Rwanda)</th>
                      <th className="py-3.5 px-4">Contact</th>
                      <th className="py-3.5 px-4">Registered</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Sync</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {carwashes?.map(cw => (
                      <tr
                        key={cw.id}
                        className={`hover:bg-slate-50/70 transition-colors group ${
                          selectedIds.has(cw.id) ? 'bg-blue-50/50' : ''
                        }`}
                      >
                        <td className="py-4 pl-4 pr-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(cw.id)}
                            onChange={() => toggleSelect(cw.id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label={`Select ${formatCarwashDisplay(cw)}`}
                          />
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0 group-hover:scale-105 transition-transform">
                              <Droplets className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 leading-snug">
                                {formatCarwashDisplay(cw)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <p className="font-semibold text-slate-800 text-xs">
                            {cw.province?.replace(' Province', '')} &bull; {cw.district}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Sector: <span className="font-medium text-slate-700">{cw.sector || '—'}</span>
                            {cw.cell ? (
                              <> · Cell: <span className="font-medium text-slate-700">{cw.cell}</span></>
                            ) : null}
                          </p>
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
                          <span className="text-xs font-medium text-slate-700">
                            {format(new Date(cw.registration_date || cw.created_at || cw.updated_at), 'MMM d, yyyy')}
                          </span>
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
                              onClick={() => {
                                if (!isOnline) {
                                  alert('Connect to the internet to edit. Updates run on the server.');
                                  return;
                                }
                                navigate(`/register?edit=${cw.id}`);
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                isOnline
                                  ? 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                  : 'text-slate-300 cursor-not-allowed'
                              }`}
                              title={isOnline ? 'Edit Carwash' : 'Online only'}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {(user?.role === 'admin' || cw.created_by === user?.id) && (
                              <button
                                id={`delete-btn-${cw.id}`}
                        onClick={() => handleDelete(cw.id, formatCarwashDisplay(cw))}
                                className={`p-2 rounded-lg transition-colors ${
                                  isOnline
                                    ? 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                                    : 'text-slate-300 cursor-not-allowed'
                                }`}
                                title={isOnline ? 'Delete Carwash' : 'Online only — deletes sync to all devices'}
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
                <div
                  key={cw.id}
                  className={`bg-surface rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${
                    selectedIds.has(cw.id) ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-slate-200/80'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(cw.id)}
                          onChange={() => toggleSelect(cw.id)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                        />
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                          <Droplets className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-base leading-tight">{formatCarwashDisplay(cw)}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{cw.province} &bull; {cw.district}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                        cw.verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {cw.verification_status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mb-4">
                      <p><span className="font-semibold text-slate-700">Sector:</span> {cw.sector || '—'}</p>
                      {cw.cell && <p><span className="font-semibold text-slate-700">Cell:</span> {cw.cell}</p>}
                      <p><span className="font-semibold text-slate-700">Contact:</span> {cw.contact_name || 'N/A'} {cw.phone ? `(${cw.phone})` : ''}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400">
                      {format(new Date(cw.registration_date || cw.created_at || cw.updated_at), 'MMM d, yyyy')}
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
                          onClick={() => handleDelete(cw.id, formatCarwashDisplay(cw))}
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
              className={`p-4 rounded-2xl flex flex-col gap-3.5 bg-surface border shadow-sm ${
                selectedIds.has(cw.id) ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-slate-200/80'
              }`}
            >
              <div className="flex gap-3 items-center">
                <input
                  type="checkbox"
                  checked={selectedIds.has(cw.id)}
                  onChange={() => toggleSelect(cw.id)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                />
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex flex-shrink-0 items-center justify-center">
                  <Droplets className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm leading-snug">{formatCarwashDisplay(cw)}</h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      cw.verification_status === 'verified' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {cw.verification_status === 'verified' ? 'Verified' : 'Pending'}
                    </span>
                    <span className="text-xs text-slate-500 truncate">{cw.district}{cw.cell ? `, ${cw.cell}` : cw.sector ? `, ${cw.sector}` : ''}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {cw.sync_status === 'SYNCED' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(cw.registration_date || cw.created_at || cw.updated_at), 'MMM d')}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1.5 bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                <p><span className="font-semibold text-slate-800">Location:</span> {cw.province} • {cw.district}{cw.sector ? ` • ${cw.sector}` : ''}{cw.cell ? ` • ${cw.cell}` : ''}</p>
                <p><span className="font-semibold text-slate-800">Contact:</span> {cw.contact_name || 'N/A'} {cw.phone ? `(${cw.phone})` : ''}</p>
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
                    onClick={() => handleDelete(cw.id, formatCarwashDisplay(cw))}
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

      {/* Fixed bulk action bar — set registration date on selected */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-8 md:left-72 lg:left-[19rem] z-50">
          <div className="max-w-4xl mx-auto bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Clear selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <label className="sr-only" htmlFor="bulk-reg-date">
                Registration date
              </label>
              <div className="relative flex-1 sm:flex-none">
                <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  id="bulk-reg-date"
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
                  className="w-full sm:w-auto pl-8 pr-2 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                id="bulk-apply-date-btn"
                onClick={handleBulkSetDate}
                disabled={isApplyingDate || !bulkDate}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-xl whitespace-nowrap"
              >
                {isApplyingDate ? 'Applying...' : 'Set date'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

