import React, { useState, useEffect } from 'react';
import { ArrowLeft, Users, Shield, Edit2, Trash2, UserPlus, Search, CheckCircle2, Key, RefreshCw, X, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const REGIONS = [
  'National',
  'Kigali City',
  'Northern Province',
  'Southern Province',
  'Eastern Province',
  'Western Province'
];

export function UserManagement() {
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add User state
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState<'field_officer' | 'admin'>('field_officer');
  const [newRegion, setNewRegion] = useState('Kigali City');
  const [newPassword, setNewPassword] = useState('');

  // Edit User state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState<'field_officer' | 'admin'>('field_officer');
  const [editRegion, setEditRegion] = useState('Kigali City');
  const [editPassword, setEditPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ text, type });
    setTimeout(() => setNotice(null), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/admin/seed-users', { method: 'POST' });
      const data = await res.json();
      showNotification(data.message || 'Seeded successfully into Supabase');
      await fetchUsers();
    } catch (err: any) {
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newUsername) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newName, 
          username: newUsername, 
          role: newRole,
          assigned_region: newRegion,
          password: newPassword || `${newUsername}123`
        })
      });
      if (res.ok) {
        const newUser = await res.json();
        setUsers(prev => [...prev, newUser]);
        setIsAdding(false);
        setNewName('');
        setNewUsername('');
        setNewPassword('');
        setNewRole('field_officer');
        setNewRegion('Kigali City');
        showNotification(`Created and synced officer @${newUser.username} to Supabase.`);
      } else {
        showNotification('Failed to create user in database.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Error creating user.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (user: any) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditUsername(user.username || '');
    setEditRole(user.role === 'admin' ? 'admin' : 'field_officer');
    setEditRegion(user.assigned_region || 'Kigali City');
    setEditPassword('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          username: editUsername,
          role: editRole,
          assigned_region: editRole === 'admin' ? 'National' : editRegion,
          ...(editPassword ? { password: editPassword } : {})
        })
      });

      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === editingUser.id ? {
          ...u,
          name: editName,
          username: editUsername,
          role: editRole,
          assigned_region: editRole === 'admin' ? 'National' : editRegion
        } : u));
        setEditingUser(null);
        showNotification(`Updated @${editUsername} successfully in Supabase.`);
      } else {
        showNotification('Failed to update user in Supabase.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showNotification(`Error: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (currentUser?.id === id || currentUser?.username === username) {
      alert('You cannot delete your own active administrator account.');
      return;
    }

    if (window.confirm(`Are you sure you want to remove user "@${username}"? This will delete the account from Supabase database.`)) {
      try {
        const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setUsers(prev => prev.filter(u => u.id !== id));
          showNotification(`User @${username} removed from Supabase.`);
        } else {
          showNotification('Failed to delete user from Supabase.', 'error');
        }
      } catch (err: any) {
        console.error(err);
        showNotification(`Error deleting user: ${err.message}`, 'error');
      }
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.assigned_region?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* ================= MOBILE APP BAR (< md) ================= */}
      <header className="md:hidden bg-surface px-4 h-14 flex items-center justify-between sticky top-0 z-20 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-slate-900">User Management</h1>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)} 
          className="p-2 rounded-xl bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </header>

      {/* ================= DESKTOP HEADER (>= md) ================= */}
      <header className="hidden md:block bg-surface border-b border-slate-200/80 px-8 py-6 sticky top-0 z-20 backdrop-blur-md bg-white/90">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <span className="cursor-pointer hover:text-slate-600" onClick={() => navigate('/admin')}>Dashboard</span>
              <span>/</span>
              <span className="text-blue-600">User Management</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff & Field Officers</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Manage authorized accounts, field surveyors, and administrative access privileges
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
              title="Seed Admin and Staff into Supabase PostgreSQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              <span>{isSeeding ? 'Seeding...' : 'Seed to Supabase'}</span>
            </button>
            <button
              onClick={fetchUsers}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Refresh users"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setIsAdding(!isAdding); setEditingUser(null); }}
              className="bg-brand-primary hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isAdding ? 'Close Panel' : 'Add New Officer'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="px-4 py-6 md:px-8 md:py-8 max-w-7xl mx-auto w-full flex-1">
        
        {notice && (
          <div className={`mb-6 p-4 rounded-xl border text-sm font-semibold flex items-center justify-between transition-all ${
            notice.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{notice.text}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-xs opacity-75 hover:opacity-100 underline">Dismiss</button>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Edit User Account</h3>
                    <p className="text-xs text-slate-500">Update officer permissions and Supabase credentials</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingUser(null)} 
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Full Legal Name</label>
                  <input 
                    type="text" 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                    required 
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Username</label>
                    <input 
                      type="text" 
                      value={editUsername} 
                      onChange={e => setEditUsername(e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Role</label>
                    <select 
                      value={editRole} 
                      onChange={e => setEditRole(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="field_officer">Field Officer (Surveyor)</option>
                      <option value="admin">System Administrator</option>
                    </select>
                  </div>
                </div>

                {editRole === 'field_officer' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Assigned Region</label>
                    <select 
                      value={editRegion} 
                      onChange={e => setEditRegion(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {REGIONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Reset Password <span className="text-slate-400 font-normal lowercase">(leave empty to keep current)</span>
                  </label>
                  <input 
                    type="password" 
                    value={editPassword} 
                    onChange={e => setEditPassword(e.target.value)} 
                    placeholder="Enter new password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setEditingUser(null)} 
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-dark shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving to Supabase...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add User Form / Card */}
        {isAdding && (
          <div className="mb-6 p-6 rounded-2xl bg-surface border border-blue-200 shadow-lg shadow-blue-500/5 transition-all">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Provision New Staff Account</h3>
                  <p className="text-xs text-slate-500">Create an authorized surveyor or admin profile in Supabase</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAdding(false)} 
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Full Legal Name</label>
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                    placeholder="e.g. Marie Claire Uwase" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">System Username</label>
                  <input 
                    type="text" 
                    value={newUsername} 
                    onChange={e => setNewUsername(e.target.value)} 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                    placeholder="e.g. muwase" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Assigned Role</label>
                  <select 
                    value={newRole} 
                    onChange={e => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="field_officer">Field Officer (Surveyor)</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">Assigned Region</label>
                  <select 
                    value={newRegion} 
                    onChange={e => setNewRegion(e.target.value)}
                    disabled={newRole === 'admin'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                  >
                    {REGIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Default initial password: <strong className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{newUsername || 'username'}123</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button" 
                    onClick={() => setIsAdding(false)} 
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-dark shadow-sm transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving to Supabase...' : 'Save & Provision to Supabase'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-surface p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by officer name, username, region, or role..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 w-full sm:w-auto justify-between sm:justify-start">
            <span>Total Officers: <strong className="text-slate-800 font-bold">{users.length}</strong></span>
          </div>
        </div>

        {/* ================= DESKTOP TABLE VIEW (>= md) ================= */}
        <div className="hidden md:block bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-6">User / Staff Member</th>
                  <th className="py-3.5 px-6">System Username</th>
                  <th className="py-3.5 px-6">Role & Permissions</th>
                  <th className="py-3.5 px-6">Assigned Region</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No staff accounts match the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">{u.name}</span>
                            <span className="text-xs text-slate-400">ID: {u.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-600">
                        @{u.username}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          u.role === 'admin' 
                            ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <Shield className="w-3 h-3" />
                          <span>{u.role === 'admin' ? 'Administrator' : 'Field Surveyor'}</span>
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {u.assigned_region || (u.role === 'admin' ? 'National' : 'Kigali City')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active (Supabase)</span>
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEdit(u)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit User"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            disabled={currentUser?.id === u.id || currentUser?.username === u.username}
                            className={`p-1.5 rounded-lg transition-colors ${
                              currentUser?.id === u.id || currentUser?.username === u.username
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={currentUser?.id === u.id ? "Cannot delete active session" : "Delete User"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= MOBILE CARD FEED (< md) ================= */}
        <div className="md:hidden space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="bg-surface p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
              No staff members found.
            </div>
          ) : (
            filteredUsers.map(u => (
              <div key={u.id} className="p-4 rounded-2xl bg-surface border border-slate-200/80 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-base flex-shrink-0">
                    {u.name?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 text-sm truncate">{u.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">@{u.username}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        <Shield className="w-2.5 h-2.5" />
                        {u.role === 'admin' ? 'Admin' : 'Surveyor'}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {u.assigned_region || 'Kigali City'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(u)}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(u.id, u.username)}
                    disabled={currentUser?.id === u.id || currentUser?.username === u.username}
                    className={`p-2 rounded-xl ${
                      currentUser?.id === u.id || currentUser?.username === u.username
                        ? 'text-slate-300'
                        : 'text-slate-500 hover:text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  );
}

