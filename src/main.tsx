import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Capture native beforeinstallprompt event as early as possible
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default browser mini-bar from showing
    e.preventDefault();
    // Stash the event so we can trigger it upon clicking our custom button
    (window as any).deferredPrompt = e;
    console.log('⚡ [PWA Global] Captured beforeinstallprompt event early in main.tsx!');
    // Broadcast it to any listening React components
    window.dispatchEvent(new CustomEvent('global-beforeinstallprompt', { detail: e }));
  });

  // Also listen for successfully installed event
  window.addEventListener('appinstalled', () => {
    console.log('🎉 [PWA Global] App installed successfully!');
    (window as any).deferredPrompt = null;
    // Broadcast a custom event
    window.dispatchEvent(new CustomEvent('global-appinstalled'));
  });
}

// Register Service Worker for PWA standalone display and offline capability
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered successfully with scope:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
