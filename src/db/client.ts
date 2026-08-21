import Dexie, { type Table } from 'dexie';

export interface LocalCarwash {
  id: string;
  name: string;
  province: string;
  district: string;
  sector: string;
  lat?: number;
  lng?: number;
  address?: string;
  contact_name?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'closed';
  verification_status: 'verified' | 'unverified';
  /** ISO date (YYYY-MM-DD or full ISO) when the carwash was registered in the field */
  registration_date?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  notes?: string;
  
  // Offline Sync Metadata
  sync_status: 'SYNCED' | 'PENDING' | 'CONFLICT';
}

export interface SyncOperation {
  id: string;
  type: 'upsert_carwash' | 'delete_carwash';
  payload: any;
  created_at: string;
}

export class CarwashDatabase extends Dexie {
  carwashes!: Table<LocalCarwash, string>;
  sync_queue!: Table<SyncOperation, string>;

  constructor() {
    super('RwandaCarwashDB');
    
    this.version(1).stores({
      carwashes: 'id, name, province, district, sync_status, updated_at',
      sync_queue: 'id, type, created_at'
    });
  }
}

export const db = new CarwashDatabase();

/** Wipe all local registry data (IndexedDB). Call after server reset or on fresh login sync. */
export async function clearLocalRegistry(): Promise<void> {
  await db.transaction('rw', db.carwashes, db.sync_queue, async () => {
    await db.carwashes.clear();
    await db.sync_queue.clear();
  });
}
