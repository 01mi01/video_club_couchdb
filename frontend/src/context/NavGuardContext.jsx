import { createContext, useContext, useCallback, useRef } from 'react';

/**
 * Permite que una pantalla con cambios sin guardar (ej. Configuración)
 * INTERCEPTE la navegación disparada por el sidebar, para poder mostrar
 * su propio aviso ("tienes cambios sin guardar") antes de salir.
 *
 * LIMITACIÓN HONESTA: esta app usa `<Routes>` declarativo (no un "data
 * router" vía `createBrowserRouter`), así que el `useBlocker` nativo de
 * React Router (que también atraparía el botón "atrás" del navegador) no
 * está disponible aquí. Este mecanismo cubre navegación por el sidebar
 * (el 100% de la navegación normal de esta app de un solo panel) y, junto
 * con `beforeunload`, el cierre de pestaña/recarga — no el botón "atrás".
 *
 * Uso:
 *   const { register } = useNavGuard();
 *   useEffect(() => register({ tryNavigate: (to) => !dirty }), [dirty]);
 *   // si `tryNavigate` devuelve false, la pantalla que lo registró debe
 *   // mostrar su propia confirmación y navegar ella misma si el usuario acepta.
 */
const NavGuardContext = createContext(null);

export function NavGuardProvider({ children }) {
  const guardRef = useRef(null);

  const register = useCallback((guard) => {
    guardRef.current = guard;
    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);

  // Devuelve true si es seguro navegar de inmediato (nadie bloqueó, o el
  // guard registrado dice que sí). Devuelve false si el guard decidió
  // interceptar (típicamente porque va a mostrar su propio modal).
  const tryNavigate = useCallback((to) => {
    if (!guardRef.current) return true;
    return guardRef.current.tryNavigate(to);
  }, []);

  return (
    <NavGuardContext.Provider value={{ register, tryNavigate }}>{children}</NavGuardContext.Provider>
  );
}

export function useNavGuard() {
  const ctx = useContext(NavGuardContext);
  if (!ctx) throw new Error('useNavGuard debe usarse dentro de <NavGuardProvider>');
  return ctx;
}
