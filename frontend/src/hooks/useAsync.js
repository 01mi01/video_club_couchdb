import { useState, useEffect, useCallback, useRef } from 'react';

// Hook minimo para cargar datos: expone { data, loading, error, reload }.
// `fn` debe ser estable (useCallback) o pasarse en `deps`.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (mounted.current) setState({ data, loading: false, error: null });
    } catch (e) {
      if (mounted.current) setState({ data: null, loading: false, error: e.message || 'Error' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  return { ...state, reload: run };
}
