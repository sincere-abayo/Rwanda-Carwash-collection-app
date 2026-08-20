import { useEffect, useCallback } from 'react';
import { db } from '../db/client';
import { useSyncStore } from '../store/useSyncStore';
import { useAuthStore } from '../store/useAuthStore';

// Global triggerSync function callable from anywhere
export async function performSync(): Promise<void> {
  const { isOnline, setSyncing, setLastSyncTime, setPendingCount } = useSyncStore.getState();
  const token = useAuthStore.getState().token;
  
  if (!isOnline) return;

  setSyncing(true);
  try {
    const pendingOperations = await db.sync_queue.toArray();
    
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        mutations: pendingOperations,
        lastSync: useSyncStore.getState().lastSyncTime
      })
    });

    if (!response.ok) throw new Error('Sync request failed');
    const data = await response.json();

    // Update local DB with server truth
    await db.transaction('rw', db.carwashes, db.sync_queue, async () => {
      // Clear successfully synced operations
      if (pendingOperations.length > 0) {
        const opIds = pendingOperations.map(op => op.id);
        await db.sync_queue.bulkDelete(opIds);
      }

      // Mark local as synced
      const pendingCarwashes = pendingOperations.map(op => op.payload?.id).filter(Boolean);
      for (const id of pendingCarwashes) {
        await db.carwashes.update(id, { sync_status: 'SYNCED' });
      }

      // Apply incoming server updates
      if (data.carwashes && Array.isArray(data.carwashes)) {
        for (const serverRecord of data.carwashes) {
          await db.carwashes.put({
            ...serverRecord,
            sync_status: 'SYNCED'
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

    // Watch for local DB queue changes and auto-sync immediately if online
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

  // Initial sync on mount if online
  useEffect(() => {
    if (isOnline) {
      performSync();
    }
  }, [isOnline]);

  return { triggerSync: performSync };
}
