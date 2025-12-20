import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode removed intentionally for the game loop to prevent double-init in dev, 
  // though we handle cleanup carefully, it is smoother for canvas games without it in dev.
  <React.Fragment>
    <App />
  </React.Fragment>
);