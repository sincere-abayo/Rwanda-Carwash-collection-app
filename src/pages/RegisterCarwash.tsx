import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Save,
  Check,
  Phone,
  User,
  Building,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Copy,
} from 'lucide-react';
import { RWANDA_HIERARCHY } from '../lib/location-data';
import { db, type LocalCarwash } from '../db/client';
import { generateId } from '../lib/utils';
import { useAuthStore } from '../store/useAuthStore';
import { performSync, updateCarwashOnServer } from '../hooks/useSyncEngine';
import { useSyncStore } from '../store/useSyncStore';

type EntryDraft = {
  key: string;
  name: string;
  address: string;
  contact_name: string;
  phone: string;
  notes: string;
  status: 'active' | 'inactive';
};

function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyEntry(): EntryDraft {
  return {
    key: generateId(),
    name: '',
    address: '',
    contact_name: '',
    phone: '',
    notes: '',
    status: 'active',
  };
}

function registrationToCreatedAt(dateStr: string): string {
  // Store noon local as ISO so date-only fields don't shift timezone
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

export function RegisterCarwash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const user = useAuthStore((state) => state.user);
  const isOnline = useSyncStore((s) => s.isOnline);
  const isEdit = Boolean(editId);

  const [shared, setShared] = useState({
    registration_date: todayLocalISO(),
    province: '',
    district: '',
    sector: '',
  });

  const [entries, setEntries] = useState<EntryDraft[]>([emptyEntry()]);
  const [originalRecord, setOriginalRecord] = useState<LocalCarwash | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const lastNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editId) return;
    db.carwashes.get(editId).then((record) => {
      if (!record) return;
      setOriginalRecord(record);
      const dateOnly = record.registration_date
        ? record.registration_date.slice(0, 10)
        : record.created_at
          ? record.created_at.slice(0, 10)
          : todayLocalISO();
      setShared({
        registration_date: dateOnly,
        province: record.province || '',
        district: record.district || '',
        sector: record.sector || '',
      });
      setEntries([
        {
          key: record.id,
          name: record.name || '',
          address: record.address || '',
          contact_name: record.contact_name || '',
          phone: record.phone || '',
          notes: record.notes || '',
          status: record.status === 'inactive' || record.status === 'closed' ? 'inactive' : 'active',
        },
      ]);
    });
  }, [editId]);

  const provinces = Object.keys(RWANDA_HIERARCHY);
  const districts = shared.province
    ? Object.keys(RWANDA_HIERARCHY[shared.province as keyof typeof RWANDA_HIERARCHY] || {})
    : [];
  const sectors =
    shared.province && shared.district
      ? (RWANDA_HIERARCHY[shared.province as keyof typeof RWANDA_HIERARCHY] as Record<string, string[]>)?.[
          shared.district
        ] || []
      : [];

  const locationReady = Boolean(shared.province && shared.district && shared.registration_date);
  const filledEntries = entries.filter((e) => e.name.trim() || e.address.trim() || e.contact_name.trim() || e.phone.trim());
  const canSave = locationReady && filledEntries.length > 0;

  const updateEntry = (key: string, patch: Partial<EntryDraft>) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, emptyEntry()]);
    setTimeout(() => lastNameInputRef.current?.focus(), 50);
  };

  const removeEntry = (key: string) => {
    setEntries((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.key !== key)));
  };

  const duplicateEntry = (key: string) => {
    setEntries((prev) => {
      const source = prev.find((e) => e.key === key);
      if (!source) return prev;
      const copy: EntryDraft = {
        ...source,
        key: generateId(),
        name: source.name ? `${source.name} (copy)` : '',
      };
      const idx = prev.findIndex((e) => e.key === key);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shared.province || !shared.district) {
      alert('Please select Province and District.');
      return;
    }
    if (!shared.registration_date) {
      alert('Please set the registration date.');
      return;
    }

    const toSave = isEdit ? entries : filledEntries;
    if (toSave.length === 0) {
      alert('Add at least one carwash with a name, address, or contact.');
      return;
    }

    setIsSubmitting(true);
    setSaveMessage(null);
    try {
      if (isEdit && !isOnline) {
        alert('Connect to the internet to edit. Updates run on the server so every device stays in sync.');
        return;
      }

      const now = new Date().toISOString();
      const createdAtFromDate = registrationToCreatedAt(shared.registration_date);
      const records: LocalCarwash[] = toSave.map((entry, index) => {
        const targetId = isEdit && originalRecord ? originalRecord.id : generateId();
        return {
          id: targetId,
          name: entry.name.trim() || `Unnamed Carwash ${index + 1}`,
          province: shared.province,
          district: shared.district,
          sector: shared.sector || '',
          address: entry.address.trim(),
          contact_name: entry.contact_name.trim(),
          phone: entry.phone.trim(),
          notes: entry.notes.trim(),
          lat: undefined,
          lng: undefined,
          status: entry.status,
          verification_status: isEdit && originalRecord ? originalRecord.verification_status : 'verified',
          registration_date: createdAtFromDate,
          created_at: isEdit && originalRecord ? originalRecord.created_at : createdAtFromDate,
          updated_at: now,
          created_by: isEdit && originalRecord ? originalRecord.created_by : user!.id,
          sync_status: 'PENDING',
        };
      });

      // Edits: server only. Creates: local queue (works offline), then sync when online.
      if (isEdit && originalRecord) {
        const record = records[0];
        await updateCarwashOnServer({
          ...record,
          registration_date: new Date(record.registration_date || record.created_at).getTime(),
          isNew: false,
        });
      } else {
        await db.transaction('rw', db.carwashes, db.sync_queue, async () => {
          for (const record of records) {
            await db.carwashes.put(record);
            await db.sync_queue.add({
              id: generateId(),
              type: 'upsert_carwash',
              payload: {
                ...record,
                registration_date: new Date(record.registration_date || record.created_at).getTime(),
                isNew: true,
              },
              created_at: now,
            });
          }
        });
        performSync().catch((err) => console.warn('Background sync on save:', err));
      }

      if (!isEdit && records.length > 1) {
        setSaveMessage(`Saved ${records.length} carwashes in ${shared.district}.`);
      }

      navigate('/registry', { replace: true });
    } catch (error: any) {
      console.error('Failed to save record', error);
      alert(error?.message || 'An error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const locationLabel = [shared.sector, shared.district, shared.province].filter(Boolean).join(' · ');

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      {/* Fixed top bar — stays visible while Layout scrolls */}
      <header className="fixed top-0 left-0 right-0 md:left-64 lg:left-72 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-3 sm:px-6 md:px-8 py-2.5 sm:py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              id="form-back-btn"
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 -ml-1 rounded-full hover:bg-slate-100 text-slate-700 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base md:text-xl text-slate-900 truncate">
                {isEdit ? 'Edit Carwash' : 'Bulk Register'}
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-500 truncate">
                {isEdit
                  ? 'Update registration details'
                  : 'Shared date & location, then add facilities'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="hidden sm:inline-flex px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              id="fixed-save-btn"
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || !canSave}
              className="bg-brand-primary hover:bg-brand-dark text-white px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : isEdit
                    ? 'Save'
                    : `Save${filledEntries.length ? ` ${filledEntries.length}` : ''}`}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Spacer so content isn't under the fixed bar */}
      <div className="h-14 sm:h-[4.25rem] shrink-0" aria-hidden="true" />

      <main className="px-3 sm:px-6 md:px-8 py-5 md:py-8 max-w-4xl mx-auto w-full flex-1">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Shared: Date + Hierarchy — always 2 columns */}
          <section className="bg-surface p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900">Shared Location &amp; Date</h2>
                  <p className="text-[11px] text-slate-500 truncate">
                    Applied to every carwash you add below
                  </p>
                </div>
              </div>
              {locationReady && (
                <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full max-w-[40%] sm:max-w-[240px] truncate">
                  <Check className="w-3 h-3 shrink-0" />
                  {locationLabel}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Date <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  id="input-cw-reg-date"
                  type="date"
                  required
                  value={shared.registration_date}
                  onChange={(e) => setShared({ ...shared, registration_date: e.target.value })}
                  className="w-full px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-xs sm:text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Province <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-cw-province"
                  required
                  value={shared.province}
                  onChange={(e) =>
                    setShared({ ...shared, province: e.target.value, district: '', sector: '' })
                  }
                  className="w-full px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 text-xs sm:text-sm font-medium text-slate-800"
                >
                  <option value="">Select</option>
                  {provinces.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  District <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-cw-district"
                  required
                  disabled={!shared.province}
                  value={shared.district}
                  onChange={(e) => setShared({ ...shared, district: e.target.value, sector: '' })}
                  className="w-full px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 text-xs sm:text-sm font-medium text-slate-800 disabled:opacity-50"
                >
                  <option value="">Select</option>
                  {districts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Sector <span className="text-slate-400 font-normal normal-case">(opt.)</span>
                </label>
                <select
                  id="select-cw-sector"
                  disabled={!shared.district}
                  value={shared.sector}
                  onChange={(e) => setShared({ ...shared, sector: e.target.value })}
                  className="w-full px-2.5 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 text-xs sm:text-sm font-medium text-slate-800 disabled:opacity-50"
                >
                  <option value="">Any</option>
                  {sectors.map((s: string) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* GPS Coordinates — hidden for now
            <div>GPS capture UI removed from active form</div>
            */}
          </section>

          {/* Bulk carwash entries */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  {isEdit ? 'Carwash Details' : 'Carwashes at this location'}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isEdit
                    ? 'Update name, address, and contact'
                    : 'Add name, landmark, then contact person — one card per facility'}
                </p>
              </div>
              {!isEdit && (
                <span className="text-[11px] font-bold tabular-nums text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {filledEntries.length} ready
                </span>
              )}
            </div>

            {!locationReady && !isEdit && (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                Choose registration date, province, and district first — then add facilities below.
              </div>
            )}

            <div className={`space-y-3 transition-opacity ${locationReady || isEdit ? 'opacity-100' : 'opacity-60'}`}>
              {entries.map((entry, index) => {
                const isLast = index === entries.length - 1;
                return (
                  <div
                    key={entry.key}
                    className="bg-surface rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-slate-50/80 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-700">
                        Facility #{index + 1}
                        {entry.name.trim() ? (
                          <span className="font-medium text-slate-500"> · {entry.name.trim()}</span>
                        ) : null}
                      </span>
                      {!isEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Duplicate row"
                            onClick={() => duplicateEntry(entry.key)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Remove"
                            disabled={entries.length <= 1}
                            onClick={() => removeEntry(entry.key)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 sm:p-5 grid grid-cols-2 gap-3 sm:gap-3.5">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Carwash Name
                        </label>
                        <input
                          ref={isLast ? lastNameInputRef : undefined}
                          id={`input-cw-name-${index}`}
                          type="text"
                          value={entry.name}
                          onChange={(e) => updateEntry(entry.key, { name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isEdit && isLast && entry.name.trim()) {
                              e.preventDefault();
                              addEntry();
                            }
                          }}
                          placeholder="e.g. Clean Ride Kigali"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Physical Street Address / Landmark
                        </label>
                        <input
                          id={`input-cw-address-${index}`}
                          type="text"
                          value={entry.address}
                          onChange={(e) => updateEntry(entry.key, { address: e.target.value })}
                          placeholder="e.g. KG 15 Ave, opposite Bank of Kigali"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          <span className="inline-flex items-center gap-1">
                            <User className="w-3 h-3" /> Contact Person
                          </span>
                        </label>
                        <input
                          id={`input-cw-contact-${index}`}
                          type="text"
                          value={entry.contact_name}
                          onChange={(e) => updateEntry(entry.key, { contact_name: e.target.value })}
                          placeholder="e.g. Jean Pierre Mugabo"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Phone
                          </span>
                        </label>
                        <input
                          id={`input-cw-phone-${index}`}
                          type="tel"
                          value={entry.phone}
                          onChange={(e) => updateEntry(entry.key, { phone: e.target.value })}
                          placeholder="+250 788 123 456"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
                        </label>
                        <input
                          id={`input-cw-notes-${index}`}
                          type="text"
                          value={entry.notes}
                          onChange={(e) => updateEntry(entry.key, { notes: e.target.value })}
                          placeholder="Water source, bays, observations..."
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Status
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateEntry(entry.key, { status: 'active' })}
                            className={`py-2.5 px-2 rounded-xl text-[11px] font-bold border ${
                              entry.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-500'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            onClick={() => updateEntry(entry.key, { status: 'inactive' })}
                            className={`py-2.5 px-2 rounded-xl text-[11px] font-bold border ${
                              entry.status === 'inactive'
                                ? 'bg-amber-50 text-amber-700 border-amber-500'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}
                          >
                            Inactive
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!isEdit && (
              <button
                type="button"
                id="btn-add-another-carwash"
                onClick={addEntry}
                disabled={!locationReady}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-blue-300 text-blue-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add another carwash here
              </button>
            )}
          </section>

          {saveMessage && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              {saveMessage}
            </p>
          )}

          <div className="pt-2 pb-6 text-center sm:text-left">
            <p className="text-[11px] sm:text-xs text-slate-500">
              {locationReady
                ? `All entries share: ${locationLabel} · ${shared.registration_date}`
                : 'Complete shared location (date, province, district) to enable save'}
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
