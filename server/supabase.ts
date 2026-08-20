import { createClient, SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const { Pool } = pg;

// Supabase REST client configuration
export const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hwurrsoukorftvrmcwwj.supabase.co';
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

// PostgreSQL Engine direct connection configuration
export const PGHOST = process.env.PGHOST || 'db.hwurrsoukorftvrmcwwj.supabase.co';
export const PGPORT = parseInt(process.env.PGPORT || '5432', 10);
export const PGUSER = process.env.PGUSER || 'postgres';
export const PGDATABASE = process.env.PGDATABASE || 'postgres';
export const PGPASSWORD = process.env.PGPASSWORD || '';
export const DATABASE_URL = process.env.DATABASE_URL || '';

let supabaseInstance: SupabaseClient | null = null;
let pgPoolInstance: pg.Pool | null = null;

// Initialize Supabase Client
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  if (SUPABASE_KEY && SUPABASE_URL) {
    try {
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      console.log(`[Supabase] Initialized client for ${SUPABASE_URL}`);
      return supabaseInstance;
    } catch (err) {
      console.error('[Supabase] Failed to initialize client:', err);
      return null;
    }
  }
  return null;
}

// Initialize direct PostgreSQL connection pool
export function getPgPool(): pg.Pool | null {
  if (pgPoolInstance) return pgPoolInstance;
  
  if (DATABASE_URL || (PGHOST && PGPASSWORD)) {
    try {
      const config: pg.PoolConfig = DATABASE_URL
        ? {
            connectionString: DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
            max: 10,
          }
        : {
            host: PGHOST,
            port: PGPORT,
            user: PGUSER,
            password: PGPASSWORD,
            database: PGDATABASE,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 5000,
            max: 10,
          };

      pgPoolInstance = new Pool(config);
      pgPoolInstance.on('error', (err) => {
        console.warn('[PostgreSQL Pool Error]:', err.message);
      });
      console.log(`[PostgreSQL Engine] Pool initialized connecting to ${PGHOST}:${PGPORT}`);
      return pgPoolInstance;
    } catch (err) {
      console.error('[PostgreSQL Engine] Failed to initialize pool:', err);
      return null;
    }
  }
  return null;
}

export interface SupabaseCarwashRow {
  id: number;
  name: string;
  province: string;
  district: string;
  sector: string;
  physical_address: string;
  primary_contact: string;
  phone_number: string;
  status: string;
  sync_status: string;
  registration_date: number;
  field_officer_id: number;
  version?: number;
}

export interface SupabaseUserRow {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  assigned_region?: string | null;
}

export interface SupabaseAuditLogRow {
  id?: number;
  user_id?: number | null;
  action: string;
  table_name: string;
  record_id?: number | null;
  timestamp: number;
}

// Local cache and fallback storage
const DB_FILE = path.join(process.cwd(), 'db.json');

export interface FallbackDatabase {
  carwashes: Record<string, any>;
  users: Record<string, any>;
  audit_logs: SupabaseAuditLogRow[];
}

const defaultLocalDb: FallbackDatabase = {
  carwashes: {},
  users: {
    '1': { id: 1, username: 'admin', role: 'admin', name: 'System Admin', assigned_region: 'National' },
    '2': { id: 2, username: 'staff', role: 'field_officer', name: 'Field Officer Kigali', assigned_region: 'Kigali City' }
  },
  audit_logs: []
};

export function readLocalDb(): FallbackDatabase {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultLocalDb, null, 2));
    return defaultLocalDb;
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!data.audit_logs) data.audit_logs = [];
    if (!data.users) data.users = defaultLocalDb.users;
    if (!data.carwashes) data.carwashes = {};
    return data;
  } catch {
    return defaultLocalDb;
  }
}

export function writeLocalDb(data: FallbackDatabase) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Ensure all database tables exist in PostgreSQL
export async function initializeDatabaseTables(): Promise<void> {
  const pool = getPgPool();
  if (!pool) return;

  try {
    // 1. Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.users (
        id BIGINT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'field_officer',
        name TEXT,
        assigned_region TEXT DEFAULT 'National',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Carwashes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.carwashes (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        province TEXT NOT NULL,
        district TEXT NOT NULL,
        sector TEXT NOT NULL,
        physical_address TEXT,
        primary_contact TEXT,
        phone_number TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        sync_status TEXT NOT NULL DEFAULT 'SYNCED',
        registration_date BIGINT NOT NULL,
        field_officer_id BIGINT,
        version INT DEFAULT 1,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        notes TEXT,
        verification_status TEXT DEFAULT 'verified',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Audit logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id BIGINT,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('[PostgreSQL Engine] Schema verified and all tables ensured (users, carwashes, audit_logs).');
  } catch (err: any) {
    console.warn('[PostgreSQL Engine] Table init notice:', err.message);
  }
}

// Convert any string or numeric ID into a valid PostgreSQL int8 bigint
export function toNumericId(id: string | number | undefined): number {
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
    return id;
  }
  if (typeof id === 'string') {
    if (/^\d+$/.test(id)) {
      const parsed = parseInt(id, 10);
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
    // Deterministic hash for string or UUID to positive 31-bit integer
    let hash = 5381;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) + hash) + id.charCodeAt(i);
      hash = hash & 0x7FFFFFFF;
    }
    return (hash % 899999999) + 100000000;
  }
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// Upsert Carwash into Supabase & PostgreSQL directly
export async function dbUpsertCarwash(payload: any): Promise<{ success: boolean; id: number; error?: string }> {
  const numericId = toNumericId(payload.id);
  const regDate = payload.registration_date || (payload.created_at ? new Date(payload.created_at).getTime() : Date.now());
  const fieldOfficerId = toNumericId(payload.created_by || payload.field_officer_id || 1);
  const version = (payload.version || 0) + 1;

  const row: SupabaseCarwashRow = {
    id: numericId,
    name: payload.name || 'Unnamed Carwash',
    province: payload.province || '',
    district: payload.district || '',
    sector: payload.sector || '',
    physical_address: payload.address || payload.physical_address || '',
    primary_contact: payload.contact_name || payload.primary_contact || '',
    phone_number: payload.phone || payload.phone_number || '',
    status: payload.status || 'active',
    sync_status: 'SYNCED',
    registration_date: regDate,
    field_officer_id: fieldOfficerId,
    version,
  };

  let savedInSupabase = false;

  // 1. Try via Supabase client
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('carwashes').upsert([row]);
      if (!error) {
        savedInSupabase = true;
      } else {
        console.warn('[Supabase Carwash Upsert Error]:', error.message);
      }
    } catch (e: any) {
      console.warn('[Supabase Carwash Upsert Exception]:', e.message);
    }
  }

  // 2. Direct PG pool fallback if Supabase client failed or was null
  if (!savedInSupabase) {
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO public.carwashes (
            id, name, province, district, sector, physical_address, primary_contact, phone_number, status, sync_status, registration_date, field_officer_id, version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            province = EXCLUDED.province,
            district = EXCLUDED.district,
            sector = EXCLUDED.sector,
            physical_address = EXCLUDED.physical_address,
            primary_contact = EXCLUDED.primary_contact,
            phone_number = EXCLUDED.phone_number,
            status = EXCLUDED.status,
            sync_status = 'SYNCED',
            registration_date = EXCLUDED.registration_date,
            field_officer_id = EXCLUDED.field_officer_id,
            version = EXCLUDED.version`,
          [
            numericId,
            row.name,
            row.province,
            row.district,
            row.sector,
            row.physical_address,
            row.primary_contact,
            row.phone_number,
            row.status,
            row.sync_status,
            regDate,
            fieldOfficerId,
            version,
          ]
        );
        savedInSupabase = true;
      } catch (err: any) {
        console.error('[PostgreSQL Pool Carwash Upsert Error]:', err.message);
      }
    }
  }

  // Update local JSON cache
  const localDb = readLocalDb();
  localDb.carwashes[payload.id.toString()] = {
    ...payload,
    id: payload.id.toString(),
    sync_status: 'SYNCED',
    updated_at: new Date().toISOString()
  };
  writeLocalDb(localDb);

  // Log audit
  await logAuditEvent({
    user_id: fieldOfficerId,
    action: payload.isNew ? 'INSERT' : 'UPDATE',
    table_name: 'carwashes',
    record_id: numericId
  });

  return { success: savedInSupabase, id: numericId };
}

// Delete Carwash from Supabase & PostgreSQL directly
export async function dbDeleteCarwash(id: string | number): Promise<{ success: boolean }> {
  const numericId = toNumericId(id);
  let deleted = false;

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('carwashes').delete().eq('id', numericId);
      if (!error) deleted = true;
    } catch (e: any) {
      console.warn('[Supabase Delete Error]:', e.message);
    }
  }

  if (!deleted) {
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query('DELETE FROM public.carwashes WHERE id = $1', [numericId]);
        deleted = true;
      } catch (err: any) {
        console.error('[PostgreSQL Delete Error]:', err.message);
      }
    }
  }

  const localDb = readLocalDb();
  delete localDb.carwashes[id.toString()];
  writeLocalDb(localDb);

  await logAuditEvent({
    user_id: 1,
    action: 'DELETE',
    table_name: 'carwashes',
    record_id: numericId
  });

  return { success: deleted };
}

// Update user in Supabase & PostgreSQL
export async function dbUpdateUser(id: string | number, fields: { name?: string; username?: string; role?: string; assigned_region?: string; password?: string }): Promise<{ success: boolean; user?: any; error?: string }> {
  const numericId = toNumericId(id);
  const client = getSupabaseClient();
  let updated = false;

  const updateData: any = {};
  if (fields.username) updateData.username = fields.username;
  if (fields.role) updateData.role = fields.role;
  if (fields.assigned_region) updateData.assigned_region = fields.assigned_region;
  if (fields.password) updateData.password_hash = fields.password;

  if (client) {
    try {
      const { error } = await client.from('users').update(updateData).eq('id', numericId);
      if (!error) updated = true;
    } catch (e: any) {
      console.warn('[Supabase User Update Error]:', e.message);
    }
  }

  if (!updated) {
    const pool = getPgPool();
    if (pool) {
      try {
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (fields.username) { setClauses.push(`username = $${idx++}`); values.push(fields.username); }
        if (fields.role) { setClauses.push(`role = $${idx++}`); values.push(fields.role); }
        if (fields.assigned_region) { setClauses.push(`assigned_region = $${idx++}`); values.push(fields.assigned_region); }
        if (fields.password) { setClauses.push(`password_hash = $${idx++}`); values.push(fields.password); }

        if (setClauses.length > 0) {
          values.push(numericId);
          await pool.query(`UPDATE public.users SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
          updated = true;
        }
      } catch (err: any) {
        console.error('[PostgreSQL User Update Error]:', err.message);
      }
    }
  }

  const localDb = readLocalDb();
  if (localDb.users[id.toString()]) {
    localDb.users[id.toString()] = {
      ...localDb.users[id.toString()],
      ...fields
    };
    writeLocalDb(localDb);
  }

  await logAuditEvent({
    user_id: 1,
    action: 'UPDATE',
    table_name: 'users',
    record_id: numericId
  });

  return { success: true, user: localDb.users[id.toString()] };
}

// Delete user from Supabase & PostgreSQL
export async function dbDeleteUser(id: string | number): Promise<{ success: boolean }> {
  const numericId = toNumericId(id);
  let deleted = false;

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('users').delete().eq('id', numericId);
      if (!error) deleted = true;
    } catch (e: any) {
      console.warn('[Supabase User Delete Error]:', e.message);
    }
  }

  if (!deleted) {
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query('DELETE FROM public.users WHERE id = $1', [numericId]);
        deleted = true;
      } catch (err: any) {
        console.error('[PostgreSQL User Delete Error]:', err.message);
      }
    }
  }

  const localDb = readLocalDb();
  delete localDb.users[id.toString()];
  writeLocalDb(localDb);

  await logAuditEvent({
    user_id: 1,
    action: 'DELETE',
    table_name: 'users',
    record_id: numericId
  });

  return { success: deleted };
}

// Sync all existing local carwashes and users into Supabase PostgreSQL
export async function syncAllLocalToSupabase(): Promise<{
  success: boolean;
  carwashesSynced: number;
  usersSynced: number;
  message: string;
}> {
  const client = getSupabaseClient();
  const localDb = readLocalDb();
  const carwashes = Object.values(localDb.carwashes || {});

  let cwCount = 0;
  let userCount = 0;

  // 1. Seed users first
  try {
    const userRes = await seedDefaultUsers();
    userCount = userRes.count;
  } catch (err) {
    console.warn('[Sync All] User seed warning:', err);
  }

  // 2. Migrate/Sync all local carwashes to Supabase
  if (client && carwashes.length > 0) {
    try {
      const rowsToUpsert: SupabaseCarwashRow[] = carwashes.map((cw: any) => {
        const numericId = toNumericId(cw.id);
        const regDate = cw.registration_date || (cw.created_at ? new Date(cw.created_at).getTime() : Date.now());
        const fieldOfficerId = toNumericId(cw.created_by || cw.field_officer_id || 1);

        return {
          id: numericId,
          name: cw.name || 'Unnamed Carwash',
          province: cw.province || '',
          district: cw.district || '',
          sector: cw.sector || '',
          physical_address: cw.address || cw.physical_address || '',
          primary_contact: cw.contact_name || cw.primary_contact || '',
          phone_number: cw.phone || cw.phone_number || '',
          status: cw.status || 'active',
          sync_status: 'SYNCED',
          registration_date: regDate,
          field_officer_id: fieldOfficerId,
          version: cw.version || 1,
        };
      });

      const { data, error } = await client.from('carwashes').upsert(rowsToUpsert);
      if (error) {
        console.error('[Supabase Migrate Carwashes Error]:', error.message);
      } else {
        cwCount = rowsToUpsert.length;
        console.log(`[Supabase Migration] Successfully upserted ${cwCount} carwash records into public.carwashes`);
        
        // Update local DB status to SYNCED
        for (const cw of carwashes) {
          if (localDb.carwashes[cw.id]) {
            localDb.carwashes[cw.id].sync_status = 'SYNCED';
          }
        }
        writeLocalDb(localDb);

        // Audit log the migration
        await logAuditEvent({
          user_id: 1,
          action: 'MIGRATE_IMPORT',
          table_name: 'carwashes',
          record_id: 0,
        });
      }
    } catch (err: any) {
      console.error('[Supabase Migration Exception]:', err);
    }
  }

  // Direct PG fallback if client was not available
  if (cwCount === 0 && carwashes.length > 0) {
    const pool = getPgPool();
    if (pool) {
      try {
        for (const cw of carwashes) {
          const numericId = toNumericId(cw.id);
          const regDate = cw.registration_date || (cw.created_at ? new Date(cw.created_at).getTime() : Date.now());
          const fieldOfficerId = toNumericId(cw.created_by || cw.field_officer_id || 1);

          await pool.query(
            `INSERT INTO public.carwashes (
              id, name, province, district, sector, physical_address, primary_contact, phone_number, status, sync_status, registration_date, field_officer_id, version
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              province = EXCLUDED.province,
              district = EXCLUDED.district,
              sector = EXCLUDED.sector,
              physical_address = EXCLUDED.physical_address,
              primary_contact = EXCLUDED.primary_contact,
              phone_number = EXCLUDED.phone_number,
              status = EXCLUDED.status,
              sync_status = 'SYNCED',
              registration_date = EXCLUDED.registration_date,
              field_officer_id = EXCLUDED.field_officer_id,
              version = EXCLUDED.version`,
            [
              numericId,
              cw.name || 'Unnamed Carwash',
              cw.province || '',
              cw.district || '',
              cw.sector || '',
              cw.address || cw.physical_address || '',
              cw.contact_name || cw.primary_contact || '',
              cw.phone || cw.phone_number || '',
              cw.status || 'active',
              'SYNCED',
              regDate,
              fieldOfficerId,
              cw.version || 1,
            ]
          );
          cwCount++;
        }
      } catch (pgErr) {
        console.error('[PG Pool Migration Error]:', pgErr);
      }
    }
  }

  return {
    success: true,
    carwashesSynced: cwCount,
    usersSynced: userCount,
    message: `Migrated ${cwCount} local carwash registration(s) into Supabase PostgreSQL.`,
  };
}

// Ensure default users exist in Supabase / PostgreSQL
export async function seedDefaultUsers(): Promise<{ success: boolean; message: string; count: number }> {
  const defaultUsers: SupabaseUserRow[] = [
    {
      id: 1,
      username: 'admin',
      password_hash: 'admin123',
      role: 'admin',
      assigned_region: 'National',
    },
    {
      id: 2,
      username: 'staff',
      password_hash: 'staff123',
      role: 'field_officer',
      assigned_region: 'Kigali City',
    },
  ];

  const client = getSupabaseClient();
  if (client) {
    try {
      // Check existing users
      const { data: existingUsers, error: selectErr } = await client
        .from('users')
        .select('id, username');

      if (selectErr) {
        console.warn('[Supabase Users Check Error]:', selectErr.message);
      }

      const existingUsernames = new Set((existingUsers || []).map((u) => u.username));
      const usersToInsert = defaultUsers.filter((u) => !existingUsernames.has(u.username));

      if (usersToInsert.length > 0) {
        const { error: insertErr } = await client.from('users').upsert(usersToInsert);
        if (insertErr) {
          console.error('[Supabase Users Seed Error]:', insertErr.message);
          return { success: false, message: insertErr.message, count: existingUsers?.length || 0 };
        }
        console.log(`[Supabase] Seeded ${usersToInsert.length} default user(s) into public.users`);
      } else {
        console.log('[Supabase] Users table already has admin/staff seeded.');
      }

      // Also log audit
      await logAuditEvent({
        user_id: 1,
        action: 'SEED',
        table_name: 'users',
        record_id: 1,
      });

      const { count } = await client.from('users').select('*', { count: 'exact', head: true });
      return { success: true, message: 'Users seeded successfully into Supabase', count: count || 2 };
    } catch (err: any) {
      console.error('[Supabase Seed Exception]:', err);
      return { success: false, message: err.message || 'Seed failed', count: 0 };
    }
  }

  // Direct PG fallback
  const pool = getPgPool();
  if (pool) {
    try {
      for (const u of defaultUsers) {
        await pool.query(
          `INSERT INTO public.users (id, username, password_hash, role, assigned_region)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO NOTHING`,
          [u.id, u.username, u.password_hash, u.role, u.assigned_region]
        );
      }
      return { success: true, message: 'Seeded via direct PostgreSQL pool', count: 2 };
    } catch (err: any) {
      console.error('[PostgreSQL Pool Seed Error]:', err);
    }
  }

  return { success: false, message: 'No Supabase or PG connection available', count: 0 };
}

// Log audit event to PostgreSQL / Supabase
export async function logAuditEvent(entry: {
  user_id?: number | string | null;
  action: string;
  table_name: string;
  record_id?: number | string | null;
}) {
  const timestamp = Date.now();
  const numericUserId = entry.user_id ? toNumericId(entry.user_id) : null;
  const numericRecordId = entry.record_id ? toNumericId(entry.record_id) : null;

  const logPayload: SupabaseAuditLogRow = {
    user_id: numericUserId,
    action: entry.action,
    table_name: entry.table_name,
    record_id: numericRecordId,
    timestamp,
  };

  // Try via Supabase client
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('audit_logs').insert([logPayload]);
    } catch (e) {
      console.warn('[Supabase Audit Log] Error inserting audit log:', e);
    }
  } else {
    // Try via direct PG pool
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO public.audit_logs (user_id, action, table_name, record_id, timestamp) VALUES ($1, $2, $3, $4, $5)`,
          [numericUserId, entry.action, entry.table_name, numericRecordId, timestamp]
        );
      } catch (err) {
        console.warn('[PostgreSQL Audit Log] Error inserting:', err);
      }
    }
  }

  // Also maintain in local audit buffer
  try {
    const local = readLocalDb();
    local.audit_logs.unshift({ ...logPayload, id: Date.now() });
    if (local.audit_logs.length > 500) local.audit_logs = local.audit_logs.slice(0, 500);
    writeLocalDb(local);
  } catch (err) {
    console.warn('[Local DB] Error saving audit log:', err);
  }
}
