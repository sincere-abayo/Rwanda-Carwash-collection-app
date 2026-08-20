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
