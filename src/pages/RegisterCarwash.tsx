import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Save, Check, Droplets, Phone, User, Building, Compass, AlertCircle, ExternalLink } from 'lucide-react';
import { RWANDA_HIERARCHY } from '../lib/location-data';
import { db } from '../db/client';
import { generateId } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';
import { performSync } from '../hooks/useSyncEngine';

export function RegisterCarwash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const user = useAuthStore(state => state.user);
  
  const [formData, setFormData] = useState({
    name: '',
    province: '',
    district: '',
    sector: '',
    address: '',
    contact_name: '',
    phone: '',
    notes: '',
    status: 'active' as 'active' | 'inactive',
    lat: '',
    lng: ''
  });
  
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [gpsCaptured, setGpsCaptured] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [originalRecord, setOriginalRecord] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editId) {
      db.carwashes.get(editId).then(record => {
        if (record) {
          setOriginalRecord(record);
          setFormData({
            name: record.name || '',
            province: record.province || '',
            district: record.district || '',
            sector: record.sector || '',
            address: record.address || '',
            contact_name: record.contact_name || '',
            phone: record.phone || '',
            notes: record.notes || '',
            status: record.status || 'active',
            lat: record.lat ? record.lat.toString() : '',
            lng: record.lng ? record.lng.toString() : ''
          });
          if (record.lat && record.lng) setGpsCaptured(true);
        }
      });
    }
  }, [editId]);

  const handleCaptureGPS = () => {
    setIsCapturingGPS(true);
    setGpsError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setFormData(prev => ({
            ...prev,
            lat: pos.coords.latitude.toFixed(6),
            lng: pos.coords.longitude.toFixed(6)
          }));
          setIsCapturingGPS(false);
          setGpsCaptured(true);
        },
        (err) => {
          setGpsError('Could not capture location. Please ensure location permissions are enabled.');
          setIsCapturingGPS(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsError('Geolocation is not supported by this browser.');
      setIsCapturingGPS(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.province || !formData.district || !formData.sector) {
      alert("Please select Province, District, and Sector.");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetId = editId || generateId();
      const now = new Date().toISOString();
      
      const record = {
        id: targetId,
        name: formData.name || 'Unnamed Carwash',
        province: formData.province,
        district: formData.district,
        sector: formData.sector,
        address: formData.address,
        contact_name: formData.contact_name,
        phone: formData.phone,
        notes: formData.notes,
        lat: formData.lat ? parseFloat(formData.lat) : undefined,
        lng: formData.lng ? parseFloat(formData.lng) : undefined,
        status: formData.status,
        verification_status: originalRecord ? originalRecord.verification_status : ('verified' as const),
        created_at: originalRecord ? originalRecord.created_at : now,
        updated_at: now,
        created_by: originalRecord ? originalRecord.created_by : user!.id,
        sync_status: 'PENDING' as const
      };

      // Save to local IndexedDB and Queue for background sync
      await db.transaction('rw', db.carwashes, db.sync_queue, async () => {
        await db.carwashes.put(record);
        await db.sync_queue.add({
          id: generateId(),
          type: 'upsert_carwash',
          payload: record,
          created_at: now
        });
      });

      // Trigger immediate live sync to Supabase PostgreSQL
      performSync().catch(err => console.warn('Background sync on save:', err));

      navigate('/registry', { replace: true });
    } catch (error) {
      console.error('Failed to save record', error);
      alert('An error occurred while saving the carwash record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hierarchy derivation
  const provinces = Object.keys(RWANDA_HIERARCHY);
  const districts = formData.province ? Object.keys(RWANDA_HIERARCHY[formData.province as keyof typeof RWANDA_HIERARCHY] || {}) : [];
  const sectors = formData.province && formData.district 
    ? (RWANDA_HIERARCHY[formData.province as keyof typeof RWANDA_HIERARCHY] as any)?.[formData.district] || []
    : [];

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* ================= MOBILE HEADER (< md) ================= */}
      <header className="md:hidden bg-surface px-4 h-14 flex items-center justify-between sticky top-0 z-20 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <button 
            id="mobile-form-back"
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base text-slate-900">
            {editId ? 'Edit Carwash' : 'Register Carwash'}
          </h1>
        </div>
        <button
          id="mobile-form-save-quick"
          onClick={handleSave}
          disabled={isSubmitting}
          className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : 'Save'}
        </button>
      </header>

      {/* ================= DESKTOP HEADER (>= md) ================= */}
      <header className="hidden md:block bg-surface border-b border-slate-200/80 px-8 py-6 sticky top-0 z-20 backdrop-blur-md bg-white/90">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
              <span className="cursor-pointer hover:text-slate-600" onClick={() => navigate('/registry')}>Registry</span>
              <span>/</span>
              <span className="text-blue-600">{editId ? 'Edit Entry' : 'New Registration'}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {editId ? 'Edit Carwash Registration' : 'Register New Carwash Facility'}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Collect verified location, GPS coordinates, and administrative records for the national database
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="bg-brand-primary hover:bg-brand-dark text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Verify Record'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN FORM CONTENT ================= */}
      <main className="px-4 py-6 md:px-8 md:py-8 max-w-6xl mx-auto w-full flex-1">
        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Responsive Layout Grid: 1 col on Mobile, 2 cols on Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* COLUMN 1: Basic & Contact Information */}
            <div className="space-y-6">
              {/* Facility Information Card */}
              <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Facility Details</h2>
                    <p className="text-[11px] text-slate-500">Business identification and operational status</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Carwash Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="input-cw-name"
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Clean Ride Kigali"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Operational Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, status: 'active'})}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        formData.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-500 ring-2 ring-emerald-500/20' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> Active Facility
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, status: 'inactive'})}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                        formData.status === 'inactive' 
                          ? 'bg-amber-50 text-amber-700 border-amber-500 ring-2 ring-amber-500/20' 
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Inactive / Closed
                    </button>
                  </div>
                </div>
              </div>

              {/* Contact Information Card */}
              <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Owner & Manager Contact</h2>
                    <p className="text-[11px] text-slate-500">Representative on-site for registry compliance</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Contact Person / Owner Name
                  </label>
                  <input
                    id="input-cw-contact"
                    type="text"
                    value={formData.contact_name}
                    onChange={e => setFormData({...formData, contact_name: e.target.value})}
                    placeholder="e.g. Jean Pierre Mugabo"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    id="input-cw-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="e.g. +250 788 123 456"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Field Notes & Observations
                  </label>
                  <textarea
                    id="input-cw-notes"
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    placeholder="Add water source details, washing bays count, or facility observations..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm resize-none"
                  />
                </div>
              </div>
            </div>

            {/* COLUMN 2: Location & Geolocation Information */}
            <div className="space-y-6">
              
              {/* GPS Geolocation Card */}
              <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">GPS Coordinates</h2>
                    <p className="text-[11px] text-slate-500">Accurate satellite coordinates for mapping</p>
                  </div>
                </div>

                <button
                  id="btn-capture-gps"
                  type="button"
                  onClick={handleCaptureGPS}
                  className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all shadow-sm ${
                    gpsCaptured 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' 
                      : 'bg-brand-primary text-white hover:bg-brand-dark active:scale-[0.98]'
                  }`}
                >
                  {gpsCaptured ? (
                    <><Check className="w-4 h-4" /> Location Captured Successfully</>
                  ) : isCapturingGPS ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Acquiring High-Accuracy GPS...</>
                  ) : (
                    <><MapPin className="w-4 h-4" /> Capture Live GPS Location</>
                  )}
                </button>

                {gpsError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{gpsError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Latitude</label>
                    <input
                      id="input-cw-lat"
                      type="text"
                      value={formData.lat}
                      onChange={e => setFormData({...formData, lat: e.target.value})}
                      placeholder="-1.9441"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Longitude</label>
                    <input
                      id="input-cw-lng"
                      type="text"
                      value={formData.lng}
                      onChange={e => setFormData({...formData, lng: e.target.value})}
                      placeholder="30.0619"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {formData.lat && formData.lng && (
                  <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-blue-800 font-medium">Verify on Map:</span>
                    <a
                      href={`https://maps.google.com/?q=${formData.lat},${formData.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-bold hover:underline inline-flex items-center gap-1"
                    >
                      <span>Open Google Maps</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Administrative Division Card */}
              <div className="bg-surface p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Administrative Hierarchy</h2>
                    <p className="text-[11px] text-slate-500">Rwanda Provinces, Districts, and Sectors</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Province <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="select-cw-province"
                      required
                      value={formData.province}
                      onChange={e => setFormData({...formData, province: e.target.value, district: '', sector: ''})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 text-sm font-medium text-slate-800"
                    >
                      <option value="">Select Province</option>
                      {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      District <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="select-cw-district"
                      required
                      disabled={!formData.province}
                      value={formData.district}
                      onChange={e => setFormData({...formData, district: e.target.value, sector: ''})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 text-sm font-medium text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select District</option>
                      {districts.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Sector <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="select-cw-sector"
                      required
                      disabled={!formData.district}
                      value={formData.sector}
                      onChange={e => setFormData({...formData, sector: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 text-sm font-medium text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Select Sector</option>
                      {sectors.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Physical Street Address / Landmark
                    </label>
                    <input
                      id="input-cw-address"
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      placeholder="e.g. KG 15 Ave, Opposite Bank of Kigali"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Mobile Bottom Submit Button */}
          <div className="md:hidden pt-4">
            <button
              id="mobile-btn-save-carwash"
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors active:scale-[0.98] shadow-lg shadow-blue-500/25 text-base disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Verify Record'}</span>
            </button>
          </div>

          {/* Desktop Form Footer */}
          <div className="hidden md:flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="desktop-btn-save-carwash"
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-primary hover:bg-brand-dark text-white px-8 py-3 rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : 'Save & Verify Carwash'}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

