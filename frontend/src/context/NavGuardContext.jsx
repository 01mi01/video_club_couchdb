import { createContext, useContext, useCallback, useRef } from 'react';

/**
 * Permite que una pantalla con cambios sin guardar (ej. Configuración)
 * intercepte la navegación del sidebar para mostrar su propio aviso antes
 * de salir. Limitación: esta app usa `<Routes>` declarativo, no un "data
 * router", así que no hay `useBlocker` nativo — esto cubre navegación por
 * el sidebar y (junto con `beforeunload`) cierre de pestaña, pero no el
 * botón "atrás" del navegador.
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
