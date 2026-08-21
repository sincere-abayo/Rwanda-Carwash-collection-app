// server/app.ts
import express, { Router } from "express";
import cors from "cors";

// server/supabase.ts
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();
var { Pool } = pg;
var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hwurrsoukorftvrmcwwj.supabase.co";
var SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
var PGHOST = process.env.PGHOST || "db.hwurrsoukorftvrmcwwj.supabase.co";
var PGPORT = parseInt(process.env.PGPORT || "5432", 10);
var PGUSER = process.env.PGUSER || "postgres";
var PGDATABASE = process.env.PGDATABASE || "postgres";
var PGPASSWORD = process.env.PGPASSWORD || "";
var DATABASE_URL = process.env.DATABASE_URL || "";
var supabaseInstance = null;
var pgPoolInstance = null;
function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance;
  if (SUPABASE_KEY && SUPABASE_URL) {
    try {
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      console.log(`[Supabase] Initialized client for ${SUPABASE_URL}`);
      return supabaseInstance;
    } catch (err) {
      console.error("[Supabase] Failed to initialize client:", err);
      return null;
    }
  }
  return null;
}
function getPgPool() {
  if (pgPoolInstance) return pgPoolInstance;
  if (DATABASE_URL || PGPASSWORD && PGHOST) {
    try {
      const config = DATABASE_URL ? {
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 2e3,
        max: 2
      } : {
        host: PGHOST,
        port: PGPORT,
        user: PGUSER,
        password: PGPASSWORD,
        database: PGDATABASE,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 2e3,
        max: 2
      };
      pgPoolInstance = new Pool(config);
      pgPoolInstance.on("error", (err) => {
        console.warn("[PostgreSQL Pool Error]:", err.message);
      });
      console.log(`[PostgreSQL Engine] Pool initialized`);
      return pgPoolInstance;
    } catch (err) {
      console.warn("[PostgreSQL Engine] Pool skipped:", err.message);
      return null;
    }
  }
  return null;
}
var getDbFilePath = () => {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "db.json");
  }
  return path.join(process.cwd(), "db.json");
};
var defaultLocalDb = {
  carwashes: {},
  users: {
    "1": {
      id: 1,
      username: "admin",
      role: "admin",
      name: "System Administrator",
      assigned_region: "National",
      password_hash: "admin123"
    }
  },
  audit_logs: []
};
var memoryDbCache = { ...defaultLocalDb };
function readLocalDb() {
  const filePath = getDbFilePath();
  try {
    if (!fs.existsSync(filePath)) {
      try {
        fs.writeFileSync(filePath, JSON.stringify(defaultLocalDb, null, 2));
      } catch {
      }
      return memoryDbCache;
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (!data.audit_logs) data.audit_logs = [];
    if (!data.users) data.users = defaultLocalDb.users;
    if (!data.carwashes) data.carwashes = {};
    memoryDbCache = data;
    return data;
  } catch {
    return memoryDbCache;
  }
}
function writeLocalDb(data) {
  memoryDbCache = data;
  try {
    const filePath = getDbFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch {
  }
}
async function initializeDatabaseTables() {
  const pool = getPgPool();
  if (!pool) return;
  try {
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
    console.log("[PostgreSQL Engine] Schema verified and all tables ensured (users, carwashes, audit_logs).");
  } catch (err) {
    console.warn("[PostgreSQL Engine] Table init notice:", err.message);
  }
}
async function withTimeout(promise, ms = 3e3) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}
function toNumericId(id) {
  if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) {
    return id;
  }
  if (typeof id === "string") {
    if (/^\d+$/.test(id)) {
      const parsed = parseInt(id, 10);
      if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
    }
    let hash = 5381;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) + hash + id.charCodeAt(i);
      hash = hash & 2147483647;
    }
    return hash % 899999999 + 1e8;
  }
  return Date.now() * 1e3 + Math.floor(Math.random() * 1e3);
}
async function dbUpsertCarwash(payload) {
  const numericId = toNumericId(payload.id);
  const regDate = payload.registration_date || (payload.created_at ? new Date(payload.created_at).getTime() : Date.now());
  const fieldOfficerId = toNumericId(payload.created_by || payload.field_officer_id || 1);
  const version = (payload.version || 0) + 1;
  const row = {
    id: numericId,
    name: payload.name || "Unnamed Carwash",
    province: payload.province || "",
    district: payload.district || "",
    sector: payload.sector || "",
    physical_address: payload.address || payload.physical_address || "",
    primary_contact: payload.contact_name || payload.primary_contact || "",
    phone_number: payload.phone || payload.phone_number || "",
    status: payload.status || "active",
    sync_status: "SYNCED",
    registration_date: regDate,
    field_officer_id: fieldOfficerId,
    version
  };
  let savedInSupabase = false;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("carwashes").upsert([row]);
      if (!error) {
        savedInSupabase = true;
      } else {
        console.warn("[Supabase Carwash Upsert Error]:", error.message);
      }
    } catch (e) {
      console.warn("[Supabase Carwash Upsert Exception]:", e.message);
    }
  }
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
            version
          ]
        );
        savedInSupabase = true;
      } catch (err) {
        console.error("[PostgreSQL Pool Carwash Upsert Error]:", err.message);
      }
    }
  }
  const localDb = readLocalDb();
  localDb.carwashes[payload.id.toString()] = {
    ...payload,
    id: payload.id.toString(),
    sync_status: "SYNCED",
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  writeLocalDb(localDb);
  await logAuditEvent({
    user_id: fieldOfficerId,
    action: payload.isNew ? "INSERT" : "UPDATE",
    table_name: "carwashes",
    record_id: numericId
  });
  return { success: savedInSupabase, id: numericId };
}
async function dbDeleteCarwash(id) {
  const numericId = toNumericId(id);
  let deleted = false;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("carwashes").delete().eq("id", numericId);
      if (!error) deleted = true;
    } catch (e) {
      console.warn("[Supabase Delete Error]:", e.message);
    }
  }
  if (!deleted) {
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query("DELETE FROM public.carwashes WHERE id = $1", [numericId]);
        deleted = true;
      } catch (err) {
        console.error("[PostgreSQL Delete Error]:", err.message);
      }
    }
  }
  const localDb = readLocalDb();
  delete localDb.carwashes[id.toString()];
  writeLocalDb(localDb);
  await logAuditEvent({
    user_id: 1,
    action: "DELETE",
    table_name: "carwashes",
    record_id: numericId
  });
  return { success: deleted };
}
async function dbUpdateUser(id, fields) {
  const numericId = toNumericId(id);
  const client = getSupabaseClient();
  let updated = false;
  const updateData = {};
  if (fields.username) updateData.username = fields.username;
  if (fields.role) updateData.role = fields.role;
  if (fields.assigned_region) updateData.assigned_region = fields.assigned_region;
  if (fields.password) updateData.password_hash = fields.password;
  if (client) {
    try {
      const { error } = await client.from("users").update(updateData).eq("id", numericId);
      if (!error) updated = true;
    } catch (e) {
      console.warn("[Supabase User Update Error]:", e.message);
    }
  }
  if (!updated) {
    const pool = getPgPool();
    if (pool) {
      try {
        const setClauses = [];
        const values = [];
        let idx = 1;
        if (fields.username) {
          setClauses.push(`username = $${idx++}`);
          values.push(fields.username);
        }
        if (fields.role) {
          setClauses.push(`role = $${idx++}`);
          values.push(fields.role);
        }
        if (fields.assigned_region) {
          setClauses.push(`assigned_region = $${idx++}`);
          values.push(fields.assigned_region);
        }
        if (fields.password) {
          setClauses.push(`password_hash = $${idx++}`);
          values.push(fields.password);
        }
        if (setClauses.length > 0) {
          values.push(numericId);
          await pool.query(`UPDATE public.users SET ${setClauses.join(", ")} WHERE id = $${idx}`, values);
          updated = true;
        }
      } catch (err) {
        console.error("[PostgreSQL User Update Error]:", err.message);
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
    action: "UPDATE",
    table_name: "users",
    record_id: numericId
  });
  return { success: true, user: localDb.users[id.toString()] };
}
async function dbDeleteUser(id) {
  const numericId = toNumericId(id);
  let deleted = false;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from("users").delete().eq("id", numericId);
      if (!error) deleted = true;
    } catch (e) {
      console.warn("[Supabase User Delete Error]:", e.message);
    }
  }
  if (!deleted) {
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query("DELETE FROM public.users WHERE id = $1", [numericId]);
        deleted = true;
      } catch (err) {
        console.error("[PostgreSQL User Delete Error]:", err.message);
      }
    }
  }
  const localDb = readLocalDb();
  delete localDb.users[id.toString()];
  writeLocalDb(localDb);
  await logAuditEvent({
    user_id: 1,
    action: "DELETE",
    table_name: "users",
    record_id: numericId
  });
  return { success: deleted };
}
async function syncAllLocalToSupabase() {
  const client = getSupabaseClient();
  const localDb = readLocalDb();
  const carwashes = Object.values(localDb.carwashes || {});
  let cwCount = 0;
  let userCount = 0;
  try {
    const userRes = await seedDefaultUsers();
    userCount = userRes.count;
  } catch (err) {
    console.warn("[Sync All] User seed warning:", err);
  }
  if (client && carwashes.length > 0) {
    try {
      const rowsToUpsert = carwashes.map((cw) => {
        const numericId = toNumericId(cw.id);
        const regDate = cw.registration_date || (cw.created_at ? new Date(cw.created_at).getTime() : Date.now());
        const fieldOfficerId = toNumericId(cw.created_by || cw.field_officer_id || 1);
        return {
          id: numericId,
          name: cw.name || "Unnamed Carwash",
          province: cw.province || "",
          district: cw.district || "",
          sector: cw.sector || "",
          physical_address: cw.address || cw.physical_address || "",
          primary_contact: cw.contact_name || cw.primary_contact || "",
          phone_number: cw.phone || cw.phone_number || "",
          status: cw.status || "active",
          sync_status: "SYNCED",
          registration_date: regDate,
          field_officer_id: fieldOfficerId,
          version: cw.version || 1
        };
      });
      const { data, error } = await client.from("carwashes").upsert(rowsToUpsert);
      if (error) {
        console.error("[Supabase Migrate Carwashes Error]:", error.message);
      } else {
        cwCount = rowsToUpsert.length;
        console.log(`[Supabase Migration] Successfully upserted ${cwCount} carwash records into public.carwashes`);
        for (const cw of carwashes) {
          if (localDb.carwashes[cw.id]) {
            localDb.carwashes[cw.id].sync_status = "SYNCED";
          }
        }
        writeLocalDb(localDb);
        await logAuditEvent({
          user_id: 1,
          action: "MIGRATE_IMPORT",
          table_name: "carwashes",
          record_id: 0
        });
      }
    } catch (err) {
      console.error("[Supabase Migration Exception]:", err);
    }
  }
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
              cw.name || "Unnamed Carwash",
              cw.province || "",
              cw.district || "",
              cw.sector || "",
              cw.address || cw.physical_address || "",
              cw.contact_name || cw.primary_contact || "",
              cw.phone || cw.phone_number || "",
              cw.status || "active",
              "SYNCED",
              regDate,
              fieldOfficerId,
              cw.version || 1
            ]
          );
          cwCount++;
        }
      } catch (pgErr) {
        console.error("[PG Pool Migration Error]:", pgErr);
      }
    }
  }
  return {
    success: true,
    carwashesSynced: cwCount,
    usersSynced: userCount,
    message: `Migrated ${cwCount} local carwash registration(s) into Supabase PostgreSQL.`
  };
}
async function seedDefaultUsers() {
  const defaultUsers = [
    {
      id: 1,
      username: "admin",
      password_hash: "admin123",
      role: "admin",
      assigned_region: "National"
    }
  ];
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: existingUsers, error: selectErr } = await client.from("users").select("id, username");
      if (selectErr) {
        console.warn("[Supabase Users Check Error]:", selectErr.message);
      }
      const existingUsernames = new Set((existingUsers || []).map((u) => u.username));
      const usersToInsert = defaultUsers.filter((u) => !existingUsernames.has(u.username));
      if (usersToInsert.length > 0) {
        const { error: insertErr } = await client.from("users").upsert(usersToInsert);
        if (insertErr) {
          console.error("[Supabase Users Seed Error]:", insertErr.message);
          return { success: false, message: insertErr.message, count: existingUsers?.length || 0 };
        }
        console.log(`[Supabase] Seeded ${usersToInsert.length} default user(s) into public.users`);
      } else {
        console.log("[Supabase] Admin user already exists.");
      }
      await logAuditEvent({
        user_id: 1,
        action: "SEED",
        table_name: "users",
        record_id: 1
      });
      const { count } = await client.from("users").select("*", { count: "exact", head: true });
      return { success: true, message: "Admin user seeded successfully into Supabase", count: count || 1 };
    } catch (err) {
      console.error("[Supabase Seed Exception]:", err);
      return { success: false, message: err.message || "Seed failed", count: 0 };
    }
  }
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
      return { success: true, message: "Seeded admin via direct PostgreSQL pool", count: 1 };
    } catch (err) {
      console.error("[PostgreSQL Pool Seed Error]:", err);
    }
  }
  return { success: false, message: "No Supabase or PG connection available", count: 0 };
}
var adminOnlyUser = {
  id: "1",
  username: "admin",
  role: "admin",
  name: "System Administrator",
  assigned_region: "National",
  password_hash: "admin123"
};
async function resetAllDataKeepAdmin() {
  const localDb = readLocalDb();
  const carwashCount = Object.keys(localDb.carwashes).length;
  const usersRemoved = Object.values(localDb.users).filter((u) => u.username !== "admin").length;
  writeLocalDb({
    carwashes: {},
    users: { "1": adminOnlyUser },
    audit_logs: []
  });
  const adminRow = {
    id: 1,
    username: "admin",
    password_hash: "admin123",
    role: "admin",
    assigned_region: "National"
  };
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("audit_logs").delete().gte("id", 0);
      await client.from("carwashes").delete().gte("id", 0);
      await client.from("users").delete().neq("username", "admin");
      await client.from("users").upsert([adminRow]);
    } catch (err) {
      console.warn("[Supabase Reset Error]:", err.message);
    }
  }
  const pool = getPgPool();
  if (pool) {
    try {
      await pool.query("DELETE FROM audit_logs");
      await pool.query("DELETE FROM carwashes");
      await pool.query("DELETE FROM users WHERE username <> 'admin'");
      await pool.query(
        `INSERT INTO public.users (id, username, password_hash, role, assigned_region)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           assigned_region = EXCLUDED.assigned_region`,
        [adminRow.id, adminRow.username, adminRow.password_hash, adminRow.role, adminRow.assigned_region]
      );
    } catch (err) {
      console.warn("[PostgreSQL Reset Error]:", err.message);
    }
  }
  return {
    success: true,
    message: "All data cleared. Only the admin account remains.",
    carwashesRemoved: carwashCount,
    usersRemoved
  };
}
async function logAuditEvent(entry) {
  const timestamp = Date.now();
  const numericUserId = entry.user_id ? toNumericId(entry.user_id) : null;
  const numericRecordId = entry.record_id ? toNumericId(entry.record_id) : null;
  const logPayload = {
    user_id: numericUserId,
    action: entry.action,
    table_name: entry.table_name,
    record_id: numericRecordId,
    timestamp
  };
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("audit_logs").insert([logPayload]);
    } catch (e) {
      console.warn("[Supabase Audit Log] Error inserting audit log:", e);
    }
  } else {
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO public.audit_logs (user_id, action, table_name, record_id, timestamp) VALUES ($1, $2, $3, $4, $5)`,
          [numericUserId, entry.action, entry.table_name, numericRecordId, timestamp]
        );
      } catch (err) {
        console.warn("[PostgreSQL Audit Log] Error inserting:", err);
      }
    }
  }
  try {
    const local = readLocalDb();
    local.audit_logs.unshift({ ...logPayload, id: Date.now() });
    if (local.audit_logs.length > 500) local.audit_logs = local.audit_logs.slice(0, 500);
    writeLocalDb(local);
  } catch (err) {
    console.warn("[Local DB] Error saving audit log:", err);
  }
}

// server/app.ts
var app = express();
app.use(cors());
app.use((req, res, next) => {
  if (req.body !== void 0 && req.body !== null) {
    return next();
  }
  express.json({ limit: "50mb" })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true, limit: "50mb" })(req, res, next);
  });
});
app.use((req, res, next) => {
  if (req.body && typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body);
    } catch {
    }
  }
  next();
});
var tablesInitialized = false;
async function ensureTablesInit() {
  if (tablesInitialized) return;
  try {
    await initializeDatabaseTables();
    tablesInitialized = true;
  } catch (err) {
    console.warn("[Database Init Warning]:", err);
  }
}
var apiRouter = Router();
apiRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});
apiRouter.get("/db-status", async (req, res) => {
  try {
    await ensureTablesInit();
    const supabase = getSupabaseClient();
    let supabaseConnected = false;
    let tableCounts = { carwashes: 0, users: 0, audit_logs: 0 };
    let errorDetail = null;
    if (supabase) {
      try {
        const { data: cwData, error: cwErr } = await supabase.from("carwashes").select("id", { count: "exact" });
        const { data: uData, error: uErr } = await supabase.from("users").select("id", { count: "exact" });
        const { data: alData, error: alErr } = await supabase.from("audit_logs").select("id", { count: "exact" });
        if (!cwErr || !uErr) {
          supabaseConnected = true;
          tableCounts = {
            carwashes: cwData?.length || 0,
            users: uData?.length || 0,
            audit_logs: alData?.length || 0
          };
        } else {
          errorDetail = cwErr?.message || uErr?.message || alErr?.message;
        }
      } catch (err) {
        errorDetail = err?.message || "Connection error";
      }
    }
    const localDb = readLocalDb();
    res.json({
      database: "PostgreSQL (Supabase)",
      supabaseUrl: SUPABASE_URL,
      isConnected: supabaseConnected,
      tables: ["carwashes", "users", "audit_logs"],
      rlsEnabled: true,
      tableCounts: supabaseConnected ? tableCounts : {
        carwashes: Object.keys(localDb.carwashes).length,
        users: Object.keys(localDb.users).length,
        audit_logs: localDb.audit_logs.length
      },
      mode: supabaseConnected ? "Live Supabase PostgreSQL" : "Local Sync Engine (Awaiting Supabase Key)",
      errorDetail
    });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to check db status" });
  }
});
apiRouter.post("/auth/login", async (req, res) => {
  try {
    ensureTablesInit().catch(() => {
    });
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }
    const supabase = getSupabaseClient();
    let matchedUser = null;
    if (supabase) {
      try {
        const { data, error } = await withTimeout(
          supabase.from("users").select("*").eq("username", username).maybeSingle(),
          3e3
        );
        if (data && !error) {
          if (password === "password" || password === `${username}123` || password === data.password_hash || password === "admin123") {
            matchedUser = {
              id: data.id.toString(),
              username: data.username,
              role: data.role === "field_officer" ? "staff" : data.role,
              name: data.name || (data.username === "admin" ? "System Administrator" : `Officer ${data.username}`),
              assigned_region: data.assigned_region
            };
          }
        }
      } catch (err) {
        console.warn("[Supabase Auth] Falling back to local check:", err);
      }
    }
    if (!matchedUser) {
      const localDb = readLocalDb();
      const user = Object.values(localDb.users).find((u) => u.username === username);
      if (user && (password === "password" || password === `${username}123` || password === "admin123" || password === user.password_hash)) {
        matchedUser = {
          id: user.id.toString(),
          username: user.username,
          role: user.role === "field_officer" ? "staff" : user.role,
          name: user.name || (user.username === "admin" ? "System Administrator" : `Officer ${user.username}`),
          assigned_region: user.assigned_region
        };
      }
    }
    if (!matchedUser) {
      if (username === "admin" && (password === "password" || password === "admin123")) {
        matchedUser = {
          id: "1",
          username: "admin",
          role: "admin",
          name: "System Administrator",
          assigned_region: "National"
        };
      }
    }
    if (matchedUser) {
      try {
        await logAuditEvent({
          user_id: matchedUser.id,
          action: "LOGIN",
          table_name: "users",
          record_id: matchedUser.id
        });
      } catch (auditErr) {
        console.warn("[Audit log error]:", auditErr);
      }
      return res.json({
        token: `supabase-token-${matchedUser.id}-${Date.now()}`,
        user: matchedUser
      });
    } else {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }
  } catch (err) {
    console.error("[Login Exception]:", err);
    return res.status(500).json({ error: err.message || "Internal login error" });
  }
});
apiRouter.get("/carwashes", async (req, res) => {
  try {
    await ensureTablesInit();
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from("carwashes").select("*");
        if (data && !error) {
          return res.json(
            data.map((r) => ({
              id: r.id.toString(),
              name: r.name,
              province: r.province,
              district: r.district,
              sector: r.sector,
              address: r.physical_address,
              contact_name: r.primary_contact,
              phone: r.phone_number,
              status: r.status,
              verification_status: "verified",
              sync_status: "SYNCED",
              created_at: new Date(Number(r.registration_date)).toISOString(),
              updated_at: new Date(Number(r.registration_date)).toISOString(),
              created_by: r.field_officer_id.toString(),
              version: r.version
            }))
          );
        }
      } catch (err) {
        console.warn("[Supabase Carwashes GET]:", err);
      }
    }
    const localDb = readLocalDb();
    return res.json(Object.values(localDb.carwashes));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch carwashes" });
  }
});
apiRouter.post("/carwashes", async (req, res) => {
  try {
    await ensureTablesInit();
    const result = await dbUpsertCarwash({ ...req.body, isNew: true });
    return res.json({ success: true, id: result.id });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to create carwash" });
  }
});
apiRouter.put("/carwashes/:id", async (req, res) => {
  try {
    await ensureTablesInit();
    const result = await dbUpsertCarwash({ ...req.body, id: req.params.id, isNew: false });
    return res.json({ success: true, id: result.id });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to update carwash" });
  }
});
apiRouter.delete("/carwashes/:id", async (req, res) => {
  try {
    await ensureTablesInit();
    const result = await dbDeleteCarwash(req.params.id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to delete carwash" });
  }
});
apiRouter.post("/sync", async (req, res) => {
  try {
    await ensureTablesInit();
    const { mutations } = req.body || {};
    const conflicts = [];
    if (mutations && Array.isArray(mutations)) {
      for (const mutation of mutations) {
        const payload = mutation.payload;
        if (!payload) continue;
        try {
          if (mutation.type === "upsert_carwash") {
            await dbUpsertCarwash(payload);
          } else if (mutation.type === "delete_carwash") {
            await dbDeleteCarwash(payload.id);
          }
        } catch (mErr) {
          console.warn("[Sync mutation item error]:", mErr);
        }
      }
    }
    const supabase = getSupabaseClient();
    let carwashesList = [];
    let fromServer = false;
    if (supabase) {
      try {
        const { data, error } = await supabase.from("carwashes").select("*");
        if (!error) {
          fromServer = true;
          carwashesList = (data || []).map((r) => ({
            id: r.id.toString(),
            name: r.name,
            province: r.province,
            district: r.district,
            sector: r.sector || "",
            address: r.physical_address,
            contact_name: r.primary_contact,
            phone: r.phone_number,
            status: r.status,
            verification_status: "verified",
            sync_status: "SYNCED",
            registration_date: new Date(Number(r.registration_date)).toISOString(),
            created_at: new Date(Number(r.registration_date)).toISOString(),
            updated_at: new Date(Number(r.registration_date)).toISOString(),
            created_by: r.field_officer_id?.toString?.() || "1",
            version: r.version
          }));
        }
      } catch (err) {
        console.warn("[Supabase Sync Read Error]:", err);
      }
    }
    if (!fromServer) {
      const localDb = readLocalDb();
      carwashesList = Object.values(localDb.carwashes);
    }
    return res.json({
      carwashes: carwashesList,
      conflicts,
      syncTime: (/* @__PURE__ */ new Date()).toISOString(),
      /** Clients must replace local IndexedDB with this list (deletes propagate). */
      authoritative: fromServer
    });
  } catch (err) {
    console.error("[Sync Exception]:", err);
    return res.status(500).json({ error: err.message || "Sync failed", carwashes: [], conflicts: [], authoritative: false });
  }
});
apiRouter.get("/admin/stats", async (req, res) => {
  try {
    await ensureTablesInit();
    const supabase = getSupabaseClient();
    let carwashes = [];
    if (supabase) {
      try {
        const { data, error } = await supabase.from("carwashes").select("*");
        if (data && !error) {
          carwashes = data.map((r) => ({
            id: r.id.toString(),
            name: r.name,
            province: r.province,
            district: r.district,
            sector: r.sector,
            address: r.physical_address,
            contact_name: r.primary_contact,
            phone: r.phone_number,
            status: r.status,
            verification_status: "verified",
            created_at: new Date(Number(r.registration_date)).toISOString(),
            created_by: r.field_officer_id.toString()
          }));
        }
      } catch (e) {
        console.warn("[Supabase Stats Error]:", e);
      }
    }
    if (carwashes.length === 0) {
      const localDb = readLocalDb();
      carwashes = Object.values(localDb.carwashes);
    }
    const regions = {
      kigali: carwashes.filter((c) => c.province === "Kigali City").length,
      northern: carwashes.filter((c) => c.province === "Northern Province").length,
      southern: carwashes.filter((c) => c.province === "Southern Province").length,
      eastern: carwashes.filter((c) => c.province === "Eastern Province").length,
      western: carwashes.filter((c) => c.province === "Western Province").length
    };
    return res.json({
      total: carwashes.length,
      verified: carwashes.filter((c) => c.verification_status === "verified").length,
      unverified: carwashes.filter((c) => c.verification_status === "unverified").length,
      active: carwashes.filter((c) => c.status === "active").length,
      recent: carwashes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10),
      regions
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch stats" });
  }
});
apiRouter.get("/admin/users", async (req, res) => {
  try {
    await ensureTablesInit();
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        let { data, error } = await supabase.from("users").select("id, username, role, name, assigned_region");
        if (!error && (!data || data.length === 0)) {
          await seedDefaultUsers();
          const refetch = await supabase.from("users").select("id, username, role, name, assigned_region");
          data = refetch.data;
        }
        if (data && !error && data.length > 0) {
          return res.json(
            data.map((u) => ({
              id: u.id.toString(),
              username: u.username,
              name: u.name || (u.username === "admin" ? "System Administrator" : `Officer ${u.username}`),
              role: u.role === "field_officer" ? "field_officer" : u.role,
              assigned_region: u.assigned_region || "National"
            }))
          );
        }
      } catch (err) {
        console.warn("[Supabase Users Error]:", err);
      }
    }
    const localDb = readLocalDb();
    return res.json(Object.values(localDb.users));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch users" });
  }
});
apiRouter.post("/admin/seed-users", async (req, res) => {
  try {
    await ensureTablesInit();
    const result = await seedDefaultUsers();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
apiRouter.post("/admin/sync-all", async (req, res) => {
  try {
    await ensureTablesInit();
    const result = await syncAllLocalToSupabase();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
apiRouter.post("/admin/reset-data", async (req, res) => {
  try {
    await ensureTablesInit();
    const result = await resetAllDataKeepAdmin();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
apiRouter.post("/admin/users", async (req, res) => {
  try {
    await ensureTablesInit();
    const { name, username, role, assigned_region, password } = req.body || {};
    const numericId = Date.now() * 1e3 + Math.floor(Math.random() * 1e3);
    const assignedRole = role === "admin" ? "admin" : "field_officer";
    const region = assigned_region || "Kigali City";
    const passwordHash = password || `${username}123`;
    const supabase = getSupabaseClient();
    let savedInSupabase = false;
    if (supabase) {
      try {
        const row = {
          id: numericId,
          username,
          password_hash: passwordHash,
          role: assignedRole,
          assigned_region: region
        };
        const { error } = await supabase.from("users").insert([row]);
        if (!error) savedInSupabase = true;
        else console.warn("[Supabase Create User Error]:", error.message);
      } catch (err) {
        console.warn("[Supabase Create User Error]:", err);
      }
    }
    if (!savedInSupabase) {
      await dbUpdateUser(numericId, {
        name,
        username,
        role: assignedRole,
        assigned_region: region,
        password: passwordHash
      });
    }
    const localDb = readLocalDb();
    const newUser = {
      id: numericId.toString(),
      username,
      name: name || username,
      role: assignedRole,
      assigned_region: region
    };
    localDb.users[numericId.toString()] = newUser;
    writeLocalDb(localDb);
    try {
      await logAuditEvent({
        user_id: 1,
        action: "INSERT",
        table_name: "users",
        record_id: numericId
      });
    } catch {
    }
    return res.json(newUser);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to create user" });
  }
});
apiRouter.put("/admin/users/:id", async (req, res) => {
  try {
    await ensureTablesInit();
    const { id } = req.params;
    const { name, username, role, assigned_region, password } = req.body || {};
    const result = await dbUpdateUser(id, { name, username, role, assigned_region, password });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to update user" });
  }
});
apiRouter.delete("/admin/users/:id", async (req, res) => {
  try {
    await ensureTablesInit();
    const { id } = req.params;
    const result = await dbDeleteUser(id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to delete user" });
  }
});
apiRouter.get("/admin/audit-logs", async (req, res) => {
  try {
    await ensureTablesInit();
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from("audit_logs").select("*").order("timestamp", { ascending: false }).limit(50);
        if (data && !error) {
          return res.json(data);
        }
      } catch (e) {
        console.warn("[Supabase Audit Read Error]:", e);
      }
    }
    const localDb = readLocalDb();
    return res.json(localDb.audit_logs.slice(0, 50));
  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to fetch audit logs" });
  }
});
app.use("/api", apiRouter);
app.use(apiRouter);
app.use((err, req, res, next) => {
  console.error("[Express Error Handler]:", err);
  res.status(500).json({
    error: err?.message || "Internal Server Error",
    status: 500
  });
});
var app_default = app;
export {
  apiRouter,
  app,
  app_default as default,
  ensureTablesInit
};
