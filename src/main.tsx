import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './contexts/AuthContext';

const updateSW = registerSW({
  onRegistered(r) {
    if (r) {
      setInterval(() => {
        r.update();
      }, 20000);
    }
  },
  onNeedRefresh() {
    updateSW(true);
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    setTimeout(() => {
      window.location.reload();
    }, 500);
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
  immediate: true
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
