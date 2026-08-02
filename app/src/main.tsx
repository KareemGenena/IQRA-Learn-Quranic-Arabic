import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/700.css';
import './index.css';
import App from './App';

// A crash that blanks the page is otherwise invisible to the learner and to
// anyone debugging on a device with no console.
window.addEventListener('error', (e) => {
  document.documentElement.dataset.lastError = `${e.message} @ ${e.filename}:${e.lineno}`;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
