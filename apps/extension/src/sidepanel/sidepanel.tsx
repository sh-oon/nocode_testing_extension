import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../devtools/components/App';
import '../devtools/styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
