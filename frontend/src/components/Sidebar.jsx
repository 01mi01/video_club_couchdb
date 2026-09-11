import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavGuard } from '../context/NavGuardContext.jsx';
import { RainbowStripe } from './ui.jsx';

// Navegacion: sidebar FIJO siempre visible (panel de administracion), no
// navbar superior. Ver CLAUDE.md > Frontend - Stack y configuracion.
const NAV = [
  { to: '/', label: 'Panel', end: true },
  { to: '/videos', label: 'Películas' },
  { to: '/generos', label: 'Géneros' },
  { to: '/categorias-oscar', label: 'Categorías Oscar' },
  { to: '/zonas', label: 'Zonas' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/prestamos', label: 'Préstamos' },
  { to: '/facturas', label: 'Facturas' },
  { to: '/configuracion', label: 'Configuración' },
];

export default function Sidebar({ onNavigate }) {
  const { username, signOut } = useAuth();
  const { tryNavigate } = useNavGuard();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-ink-line bg-white">
      <div className="px-4 py-5">
        <h1 className="text-lg font-bold leading-none text-ink">Video Club</h1>
      </div>
      <RainbowStripe size="lg" />

      <nav className="flex-1 overflow-y-auto p-2.5">
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={(e) => {
                  // Si una pantalla con cambios sin guardar (ej.
                  // Configuración) intercepta la navegación, ella misma
                  // mostrará su aviso y decidirá si navega — aquí solo se
                  // cancela el link nativo.
                  if (!tryNavigate(item.to)) {
                    e.preventDefault();
                    return;
                  }
                  onNavigate?.();
                }}
                className={({ isActive }) =>
                  [
                    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'bg-ink text-white' : 'text-ink-soft hover:bg-ink/5 hover:text-ink',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-ink-line p-3">
        <p className="truncate px-1 text-sm font-semibold text-ink">{username || '—'}</p>
        <button
          onClick={signOut}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-rust/10 hover:text-rust"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
