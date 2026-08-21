import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { captureInstallPromptEarly } from './components/InstallPwaPrompt';

// Capture native install event before React mounts (otherwise it can be lost)
captureInstallPromptEarly();

const CHECK_INTERVAL_MS = 60 * 1000; // check for a new SW every minute while app is open

function scheduleUpdateChecks(registration: ServiceWorkerRegistration) {
  // Immediate check on boot
  void registration.update();

  // Periodic checks (installed PWAs often stay open without navigating)
  window.setInterval(() => {
    void registration.update();
  }, CHECK_INTERVAL_MS);

  // Check again when user returns to the app / tab
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void registration.update();
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', () => void registration.update());
}

// Register PWA service worker with auto-update + aggressive refresh
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] New version found — applying update…');
    // Activate waiting SW and reload all controlled clients
    void updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] Application is ready to work offline.');
  },
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      scheduleUpdateChecks(registration);

      // If a waiting worker already exists (e.g. after a failed prior update), activate it
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
