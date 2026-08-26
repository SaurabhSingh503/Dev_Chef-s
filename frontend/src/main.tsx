import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/App';
import '@/index.css';
import '@/styles/animations.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('MANAK: #root element is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
