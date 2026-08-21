import { useEffect, useCallback } from 'react';
import { db } from '../db/client';
import { useSyncStore } from '../store/useSyncStore';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Pull server snapshot and replace local IndexedDB.
 * When authoritative=true (or list present), records missing on the server are removed locally
 * so deletes/updates made online by another user propagate to offline devices on next sync.
 */
export async function performSync(): Promise<void> {
  const { isOnline, setSyncing, setLastSyncTime, setPendingCount } = useSyncStore.getState();
  const token = useAuthStore.getState().token;

  if (!isOnline) return;

  setSyncing(true);
  try {
    // Only push create/upsert queue items — deletes/edits are done online against the API
    const pendingOperations = (await db.sync_queue.toArray()).filter(
      (op) => op.type === 'upsert_carwash'
    );
    // Drop any legacy delete ops still sitting in the queue (no longer used offline)
    const legacyDeletes = (await db.sync_queue.toArray()).filter((op) => op.type === 'delete_carwash');

    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        mutations: pendingOperations,
        lastSync: useSyncStore.getState().lastSyncTime,
      }),
    });

    if (!response.ok) throw new Error('Sync request failed');
    const data = await response.json();

    const serverRecords = Array.isArray(data.carwashes) ? data.carwashes : [];
    // Prefer server snapshot whenever we got a successful sync response.
    // Empty array is valid (= everything deleted on server).
    const shouldReplaceLocal = data.authoritative === true || response.ok;

    await db.transaction('rw', db.carwashes, db.sync_queue, async () => {
      if (pendingOperations.length > 0) {
        await db.sync_queue.bulkDelete(pendingOperations.map((op) => op.id));
      }
      if (legacyDeletes.length > 0) {
        await db.sync_queue.bulkDelete(legacyDeletes.map((op) => op.id));
      }

      if (shouldReplaceLocal) {
        await db.carwashes.clear();
        for (const serverRecord of serverRecords) {
          await db.carwashes.put({
            ...serverRecord,
            id: String(serverRecord.id),
            sync_status: 'SYNCED',
          });
        }
      }
    });

    setLastSyncTime(data.syncTime || new Date().toISOString());
    const count = await db.sync_queue.count();
    setPendingCount(count);
  } catch (error) {
    console.error('[SyncEngine] Sync error:', error);
  } finally {
    setSyncing(false);
  }
}

/** Delete on the server only (requires online). Then refresh local DB from server. */
export async function deleteCarwashOnServer(id: string): Promise<void> {
  if (!useSyncStore.getState().isOnline) {
    throw new Error('Connect to the internet to delete a carwash. Deletes are applied on the server so all devices stay in sync.');
  }

  const res = await fetch(`/api/carwashes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to delete on server');
  }

  // Remove locally immediately, then full sync for consistency
  await db.carwashes.delete(id);
  await performSync();
}

/** Update on the server only (requires online). */
export async function updateCarwashOnServer(record: Record<string, unknown>): Promise<void> {
  if (!useSyncStore.getState().isOnline) {
    throw new Error('Connect to the internet to edit a carwash. Updates are applied on the server so all devices stay in sync.');
  }

  const id = String(record.id);
  const res = await fetch(`/api/carwashes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || 'Failed to update on server');
  }

  await performSync();
}

export function useSyncEngine() {
  const { isOnline, setOnline, setPendingCount } = useSyncStore();

  const updatePendingCount = useCallback(async () => {
    const count = await db.sync_queue.count();
    setPendingCount(count);
  }, [setPendingCount]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      performSync();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  useEffect(() => {
    updatePendingCount();

    const onQueueChange = () => {
      setTimeout(() => {
        updatePendingCount();
        if (useSyncStore.getState().isOnline) {
          performSync();
        }
      }, 50);
    };

    db.sync_queue.hook('creating', onQueueChange);
    db.sync_queue.hook('deleting', onQueueChange);

    return () => {
      db.sync_queue.hook('creating').unsubscribe(onQueueChange);
      db.sync_queue.hook('deleting').unsubscribe(onQueueChange);
    };
  }, [updatePendingCount]);

  useEffect(() => {
    if (isOnline) {
      performSync();
    }
  }, [isOnline]);

  // Periodic pull so other users' deletes/updates appear without manual refresh
  useEffect(() => {
    if (!isOnline) return;
    const id = window.setInterval(() => {
      performSync();
    }, 45_000);
    return () => window.clearInterval(id);
  }, [isOnline]);

  return { triggerSync: performSync };
}
