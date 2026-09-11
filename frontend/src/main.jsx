import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { installSpanishFormValidation } from './lib/formValidationEs.js';
import './index.css';

// Mensajes de validación nativos del navegador ("Please fill out this
// field", etc.) en español — ver lib/formValidationEs.js.
installSpanishFormValidation();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
