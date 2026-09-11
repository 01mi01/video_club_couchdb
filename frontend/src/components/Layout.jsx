import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import RefDataBanner from './RefDataBanner.jsx';
import { RefDataProvider } from '../context/RefDataContext.jsx';
import { NavGuardProvider } from '../context/NavGuardContext.jsx';

// Estructura de la app autenticada: sidebar fijo a la izquierda + area de
// contenido. En pantallas angostas el sidebar se colapsa detras de un
// boton (el uso principal es de escritorio, pero debe verse bien angosto).
export default function Layout() {
  const [open, setOpen] = useState(false);

  return (
    <RefDataProvider>
      <NavGuardProvider>
        <div className="flex min-h-screen bg-paper">
          {/* Sidebar escritorio */}
          <div className="no-print hidden lg:block">
            <div className="sticky top-0 h-screen">
              <Sidebar />
            </div>
          </div>

          {/* Sidebar movil (overlay) */}
          {open && (
            <div className="no-print fixed inset-0 z-40 lg:hidden">
              <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
              <div className="absolute left-0 top-0 h-full">
                <Sidebar onNavigate={() => setOpen(false)} />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Barra superior solo en movil, para abrir el sidebar */}
            <div className="no-print flex items-center gap-3 border-b border-ink-line bg-white px-4 py-3 lg:hidden">
              <button
                onClick={() => setOpen(true)}
                className="rounded-lg border border-ink-line px-3 py-1.5 text-sm font-medium"
              >
                Menú
              </button>
              <span className="text-base font-bold">Video Club</span>
            </div>

            {/* Sin max-width artificial: el contenido aprovecha todo el
                ancho disponible (menos vacío "perdido" en pantallas
                anchas); el padding lateral es el único límite. */}
            <main className="w-full flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7 xl:px-10">
              <RefDataBanner />
              <Outlet />
            </main>
          </div>
        </div>
      </NavGuardProvider>
    </RefDataProvider>
  );
}
