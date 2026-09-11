import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { RainbowStripe, Button, Field, TextInput, Alert } from '../components/ui.jsx';

export default function LoginPage() {
  const { isAuthed, signIn } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (isAuthed) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm">
        <div className="card overflow-hidden bg-white">
          <RainbowStripe />
          <div className="px-8 py-10">
            <div className="text-center">
              <h1 className="text-3xl font-bold leading-none text-ink">Video Club</h1>
              <p className="mt-2 text-sm text-ink-soft">Iniciar sesión</p>
            </div>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
              <Field label="Usuario" required>
                <TextInput
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Contraseña" required>
                <TextInput
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Button type="submit" className="mt-2 w-full" disabled={busy}>
                {busy ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
