// Entry point: loads the fonts and the styles, then puts <App /> into index.html.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts are bundled with the app (no internet request needed):
import '@fontsource/source-serif-4/400.css'; // book serif for text
import '@fontsource/source-serif-4/400-italic.css';
import '@fontsource/source-serif-4/600.css';

import './styles.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
