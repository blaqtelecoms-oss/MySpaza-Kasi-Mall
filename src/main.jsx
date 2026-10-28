import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// One-time cleanup: unregister any leftover Progressier service worker so it
// stops intercepting fetches and interfering with the offline caching layer.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  }).catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)