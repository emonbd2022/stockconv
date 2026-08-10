import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './contexts/AuthContext';

// Register service worker for offline support
const updateSW = registerSW({ 
  onNeedRefresh() {
    updateSW(true);
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
