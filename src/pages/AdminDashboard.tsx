import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
  LogOut,
  Map,
  Activity,
  ShieldCheck,
  Download,
  AlertTriangle,
  Plus,
  MapPin,
  RefreshCw,
  History,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { GeographicDistributionChart } from '../components/GeographicDistributionChart';
import {
  buildRegionStats,
  exportNationalExcelReport,
  exportNationalPdfReport,
  fetchReportCarwashes,
} from '../lib/reports';
import { formatCarwashDisplay } from '../lib/utils';

export function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'audit'>('overview');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, dbRes, auditRes] = await Promise.all([
        fetch('/api/admin/stats').then(r => r.json()),
        fetch('/api/db-status').then(r => r.json()),
        fetch('/api/admin/audit-logs').then(r => r.json())
      ]);
      setStats(statsRes);
      setDbStatus(dbRes);
      setAuditLogs(auditRes || []);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleExport = async (type: 'pdf' | 'excel') => {
    setExporting(type);
    try {
      const carwashes = await fetchReportCarwashes();
      const payload = {
        stats: stats || {},
        carwashes,
        generatedBy: user?.name || user?.username || 'Admin',
      };
      if (type === 'pdf') {
        await exportNationalPdfReport(payload);
      } else {
        await exportNationalExcelReport(payload);
      }
    } catch (err) {
      console.error('Report export failed:', err);
      alert('Failed to generate report. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const regionStats = buildRegionStats(stats);

  return (
    <div 
      className="min-h-dvh font-sans flex flex-col md:flex-row bg-[#0B3B8F] text-slate-50 overflow-hidden"
      style={{ background: 'radial-gradient(circle at 0% 0%, #0B3B8F 0%, #155EEF 50%, #16A34A 100%)' }}
    >
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white/5 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between text-white z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <h2 className="font-bold">CYESHA Admin</h2>
        </div>
        <button onClick={handleLogout} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors flex items-center justify-center border border-white/20 text-white">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content Dashboard */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full relative z-0">
        <div className="max-w-6xl mx-auto space-y-8">
          
          <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold">System Overview</h2>
                <button 
                  onClick={loadData} 
                  disabled={loading}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
                  title="Refresh metrics"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-blue-100 opacity-80 mt-1">National Registry & Field Operations Management</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl backdrop-blur-md">
                <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-semibold text-emerald-100 uppercase tracking-widest">
                  {dbStatus?.isConnected ? 'Cloud Connected' : 'Sync Active'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  disabled={!!exporting || loading}
                  className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
                  title="Download PDF report"
                >
                  {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('excel')}
                  disabled={!!exporting || loading}
                  className="px-3.5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-200 font-bold rounded-xl text-xs flex items-center gap-1.5 disabled:opacity-50"
                  title="Download Excel report"
                >
                  {exporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  Excel
                </button>
              </div>
              <button onClick={() => navigate('/registry')} className="flex-1 xl:flex-none px-5 py-2.5 bg-white text-[#0B3B8F] font-bold rounded-xl shadow-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
                <MapPin className="w-4 h-4" /> <span className="hidden sm:inline">Registry View</span><span className="sm:hidden">Registry</span>
              </button>
              <button onClick={() => navigate('/register')} className="hidden sm:flex flex-1 xl:flex-none px-5 py-2.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold rounded-xl shadow-xl hover:bg-emerald-500/30 transition-colors items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Register New
              </button>
            </div>
          </header>

          {/* View Switcher Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-2">
            <div className="flex items-center gap-1.5 bg-black/20 p-1.5 rounded-2xl border border-white/10 w-full sm:w-auto">
              <button 
                onClick={() => setActiveTab('overview')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'overview' 
                    ? 'bg-white text-[#0B3B8F] shadow-lg shadow-black/10' 
                    : 'text-blue-200 hover:text-white hover:bg-white/5'
                }`}
              >
                Overview
              </button>
              <button 
                onClick={() => setActiveTab('audit')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'audit' 
                    ? 'bg-white text-[#0B3B8F] shadow-lg shadow-black/10' 
                    : 'text-blue-200 hover:text-white hover:bg-white/5'
                }`}
              >
                <History className="w-3.5 h-3.5" /> Audit Logs ({auditLogs.length})
              </button>
            </div>
          </div>

          {activeTab === 'overview' && (
            <>
              {/* Stats Grid */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
                <div className="p-5 sm:p-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl relative overflow-hidden group hover:bg-white/15 transition-colors">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <MapPin className="w-24 h-24" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-blue-100 opacity-60 uppercase mb-2">Total Registrations</p>
                  <h3 className="text-3xl sm:text-4xl font-bold mt-1 tracking-tight">{stats?.total || 0}</h3>
                </div>
                <div className="p-5 sm:p-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl relative overflow-hidden group hover:bg-white/15 transition-colors">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <ShieldCheck className="w-24 h-24" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-emerald-300 uppercase mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </p>
                  <h3 className="text-3xl sm:text-4xl font-bold mt-1 tracking-tight">{stats?.verified || 0}</h3>
                </div>
                <div className="p-5 sm:p-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl relative overflow-hidden group hover:bg-white/15 transition-colors">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity text-orange-400">
                    <AlertTriangle className="w-24 h-24" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-orange-300 uppercase mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Pending Review
                  </p>
                  <h3 className="text-3xl sm:text-4xl font-bold mt-1 tracking-tight text-orange-300">{stats?.unverified || 0}</h3>
                </div>
                <div className="p-5 sm:p-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl relative overflow-hidden group hover:bg-white/15 transition-colors">
                  <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity className="w-24 h-24" />
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-blue-100 opacity-60 uppercase mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" /> Active Operations
                  </p>
                  <h3 className="text-3xl sm:text-4xl font-bold mt-1 tracking-tight">{stats?.active || 0}</h3>
                </div>
              </section>

              {/* Geographic Distribution */}
              <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-5 sm:p-6 mb-6">
                <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-white">Geographic Distribution</h4>
                      <p className="text-xs text-blue-200 opacity-75">Regional density across Rwanda provinces</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
                      5 Administrative Regions
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExport('pdf')}
                      disabled={!!exporting}
                      className="text-xs font-bold text-white/90 bg-white/10 hover:bg-white/20 border border-white/15 px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" /> Report
                    </button>
                  </div>
                </div>

                <GeographicDistributionChart
                  variant="dark"
                  total={stats?.total || 0}
                  regions={regionStats}
                />
              </section>

              {/* Recent Field Syncs Table */}
              <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl flex flex-col overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                  <h4 className="font-bold text-lg">Recent Field Syncs</h4>
                  <button onClick={() => navigate('/registry')} className="text-sm text-blue-200 hover:text-white underline transition-colors">View All in Registry</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="text-xs font-semibold uppercase text-blue-200 opacity-60 border-b border-white/10">
                      <tr>
                        <th className="px-5 sm:px-6 py-4">Carwash Facility</th>
                        <th className="px-5 sm:px-6 py-4">Location</th>
                        <th className="px-5 sm:px-6 py-4">Status</th>
                        <th className="px-5 sm:px-6 py-4 text-right">Sync Time</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {stats?.recent?.map((cw: any) => (
                        <tr key={cw.id} onClick={() => navigate('/registry')} className="border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                          <td className="px-5 sm:px-6 py-4 font-medium group-hover:text-emerald-300 transition-colors">{formatCarwashDisplay(cw)}</td>
                          <td className="px-5 sm:px-6 py-4 opacity-80">{[cw.cell, cw.sector, cw.district].filter(Boolean).join(', ') || '—'}</td>
                          <td className="px-5 sm:px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${cw.verification_status === 'verified' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-orange-500/20 text-orange-300 border-orange-500/30'}`}>
                              {cw.verification_status === 'verified' ? 'Verified' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-5 sm:px-6 py-4 opacity-80 text-right whitespace-nowrap">
                            {cw.created_at ? format(new Date(cw.created_at), 'MMM d, HH:mm') : 'Recently'}
                          </td>
                        </tr>
                      ))}
                      {!stats?.recent?.length && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-blue-200 opacity-60">
                            <div className="flex flex-col items-center justify-center">
                              <Map className="w-8 h-8 mb-3 opacity-50" />
                              <p>No recent data synchronized.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === 'audit' && (
            <section className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-400" />
                    System Audit Trail (`public.audit_logs`)
                  </h3>
                  <p className="text-sm text-blue-200/80 mt-0.5">Real-time mutation audit trail and security log</p>
                </div>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold">
                  RLS Protected
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead className="text-xs font-semibold uppercase text-blue-200 opacity-60 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Table Name</th>
                      <th className="px-4 py-3">Record ID</th>
                      <th className="px-4 py-3">User ID</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-white/5">
                    {auditLogs.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-blue-100">
                          {log.timestamp ? format(new Date(Number(log.timestamp)), 'yyyy-MM-dd HH:mm:ss') : 'Just now'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            log.action === 'INSERT' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            log.action === 'UPSERT' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                            log.action === 'DELETE' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                            'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-emerald-300">{log.table_name}</td>
                        <td className="px-4 py-3 font-mono text-xs opacity-80">{log.record_id || '-'}</td>
                        <td className="px-4 py-3 font-mono text-xs opacity-80">{log.user_id || '1'}</td>
                      </tr>
                    ))}
                    {!auditLogs.length && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-blue-200/60">
                          No audit logs recorded yet. Perform a sync or mutation to generate records.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          
        </div>
      </main>
    </div>
  );
}

