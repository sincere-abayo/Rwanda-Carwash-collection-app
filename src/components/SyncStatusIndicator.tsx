import { CloudOff, Cloud, RefreshCw } from 'lucide-react';
import { useSyncStore } from '../store/useSyncStore';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { motion, AnimatePresence } from 'framer-motion';

export function SyncStatusIndicator() {
  const { isOnline, isSyncing, pendingCount } = useSyncStore();
  const { triggerSync } = useSyncEngine();

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <AnimatePresence mode="wait">
        {!isOnline ? (
          <motion.div
            key="offline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-brand-warning bg-brand-warning/10 px-3 py-1.5 rounded-full"
          >
            <CloudOff className="w-4 h-4" />
            <span>Offline &middot; {pendingCount} waiting</span>
          </motion.div>
        ) : isSyncing ? (
          <motion.div
            key="syncing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-full"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            <span>Syncing...</span>
          </motion.div>
        ) : (
          <motion.div
            key="online"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-brand-success bg-brand-success/10 px-3 py-1.5 rounded-full"
            onClick={triggerSync}
            role="button"
          >
            <Cloud className="w-4 h-4" />
            <span>Synced</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
