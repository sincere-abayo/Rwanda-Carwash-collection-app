import React, { useState, useEffect, useCallback } from 'react';
import { Download, X, Share2, PlusSquare, Check, Loader2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __pwaDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

const installListeners = new Set<() => void>();

function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return window.__pwaDeferredPrompt ?? null;
}

function setDeferredPromptGlobal(prompt: BeforeInstallPromptEvent | null) {
  window.__pwaDeferredPrompt = prompt;
  installListeners.forEach((cb) => cb());
}

function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

function isIosDevice(): boolean {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (ua.includes('macintosh') && 'ontouchend' in document);
}

/** Triggers the native install dialog when available; otherwise opens the platform guide. */
export async function promptInstall() {
  const deferred = getDeferredPrompt();
  if (deferred) {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferredPromptGlobal(null);
    return;
  }

  window.dispatchEvent(new CustomEvent('open-pwa-install-guide'));
}

/** Call once at app boot (before React) so the native install event is never missed. */
export function captureInstallPromptEarly() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    setDeferredPromptGlobal(e as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    setDeferredPromptGlobal(null);
  });
}

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  const syncPromptState = useCallback(() => {
    setDeferredPrompt(getDeferredPrompt());
  }, []);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());
    setIsIOS(isIosDevice());
    setDeferredPrompt(getDeferredPrompt());

    if (sessionStorage.getItem('pwa_prompt_dismissed')) {
      setIsDismissed(true);
    }

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setShowGuide(false);
    };

    const handleOpenGuide = () => setShowGuide(true);

    installListeners.add(syncPromptState);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open-pwa-install-guide', handleOpenGuide);

    return () => {
      installListeners.delete(syncPromptState);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-install-guide', handleOpenGuide);
    };
  }, [syncPromptState]);

  if (isStandalone) return null;

  const canNativeInstall = Boolean(deferredPrompt);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsStandalone(true);
        }
      } finally {
        setDeferredPromptGlobal(null);
        setDeferredPrompt(null);
        setInstalling(false);
      }
      return;
    }

    // iOS (and browsers without beforeinstallprompt) need a manual guide
    setShowGuide(true);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  // On Chromium: only show the banner once the real install prompt is available.
  // On iOS: show banner so users can open the Add-to-Home-Screen guide.
  const showBanner = !isDismissed && (canNativeInstall || isIOS);

  return (
    <>
      {showBanner && (
        <div
          id="pwa-install-banner"
          className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-slate-900/95 border border-blue-500/40 text-slate-100 rounded-2xl p-4 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
              <img src="/pwa-192x192.png" alt="" className="w-11 h-11" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-white">Install Rwanda Carwash App</h4>
                <button
                  id="dismiss-install-banner-btn"
                  onClick={handleDismiss}
                  className="text-slate-400 hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-800 transition"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {canNativeInstall
                  ? 'Install for offline data entry and home-screen access.'
                  : 'Add to your Home Screen for offline use and quick access.'}
              </p>

              <div className="flex items-center gap-2 mt-3">
                <button
                  id="install-pwa-action-btn"
                  onClick={handleInstallClick}
                  disabled={installing}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md active:scale-95 transition disabled:opacity-70"
                >
                  {installing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {canNativeInstall ? 'Install App' : 'How to Install'}
                </button>
                <button
                  id="later-install-btn"
                  onClick={handleDismiss}
                  className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl hover:bg-slate-800 transition"
                >
                  Not Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <img src="/pwa-192x192.png" alt="" className="w-12 h-12 rounded-2xl shadow-lg" />
              <div>
                <h3 className="font-bold text-base text-white">
                  {isIOS ? 'Add to Home Screen' : 'Install from browser'}
                </h3>
                <p className="text-xs text-blue-300">Rwanda Carwash Registry</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3.5 text-xs text-slate-300 mb-6">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-xs flex-shrink-0">
                    1
                  </span>
                  <div>
                    <p className="font-semibold text-white">Tap Share</p>
                    <p className="text-slate-400 mt-0.5 flex items-center gap-1">
                      In Safari: <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-xs flex-shrink-0">
                    2
                  </span>
                  <div>
                    <p className="font-semibold text-white">Add to Home Screen</p>
                    <p className="text-slate-400 mt-0.5 flex items-center gap-1">
                      Scroll and tap <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" />
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600/30 text-blue-400 font-bold text-xs flex-shrink-0">
                    3
                  </span>
                  <div>
                    <p className="font-semibold text-white">Tap Add</p>
                    <p className="text-slate-400 mt-0.5">The app opens like a native app.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-300 mb-6">
                <p>
                  Open this site in <span className="text-white font-semibold">Chrome</span> or{' '}
                  <span className="text-white font-semibold">Edge</span> on Android/desktop, then use
                  the browser menu → <span className="text-white font-semibold">Install app</span>.
                </p>
                <p className="text-slate-400">
                  If Install is missing, hard-refresh once so the service worker and icons can load.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs py-3 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}
