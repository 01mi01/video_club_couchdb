import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { RainbowStripe } from './ui.jsx';

// Navegacion: sidebar FIJO siempre visible (panel de administracion), no
// navbar superior. Ver CLAUDE.md > Frontend - Stack y configuracion.
const NAV = [
  { to: '/', label: 'Panel', end: true },
  { to: '/videos', label: 'Películas' },
  { to: '/generos', label: 'Géneros' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/prestamos', label: 'Préstamos' },
  { to: '/facturas', label: 'Facturas' },
  { to: '/configuracion', label: 'Configuración' },
];

export default function Sidebar({ onNavigate }) {
  const { username, signOut } = useAuth();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r-2 border-ink bg-paper">
      <div className="border-b-2 border-ink px-5 py-5">
        <p className="eyebrow">Base de Datos Avanzadas</p>
        <h1 className="mt-1 font-display text-2xl font-semibold leading-none text-ink">
          Video Club
        </h1>
        <p className="mt-1 text-xs text-ink-soft">Administración — CouchDB</p>
      </div>
      <RainbowStripe />

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  [
                    'block border-2 px-3 py-2 text-sm font-semibold uppercase tracking-label transition-colors',
                    isActive
                      ? 'border-ink bg-ink text-paper'
                      : 'border-transparent text-ink hover:border-ink hover:bg-cream',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t-2 border-ink p-4">
        <p className="text-xs text-ink-soft">Propietario</p>
        <p className="truncate text-sm font-semibold text-ink">{username || '—'}</p>
        <button
          onClick={signOut}
          className="mt-2 w-full border-2 border-ink px-3 py-1.5 text-xs font-semibold uppercase tracking-label text-ink hover:bg-rust hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
