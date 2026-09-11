import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';

import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import GenresPage from './pages/GenresPage.jsx';
import OscarCategoriesPage from './pages/OscarCategoriesPage.jsx';
import VideosPage from './pages/VideosPage.jsx';
import VideoFormPage from './pages/VideoFormPage.jsx';
import VideoDetailPage from './pages/VideoDetailPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import ClientFormPage from './pages/ClientFormPage.jsx';
import ClientDetailPage from './pages/ClientDetailPage.jsx';
import LoansPage from './pages/LoansPage.jsx';
import NewLoanPage from './pages/NewLoanPage.jsx';
import LoanDetailPage from './pages/LoanDetailPage.jsx';
import InvoicesPage from './pages/InvoicesPage.jsx';
import ConfigPage from './pages/ConfigPage.jsx';

function RequireAuth({ children }) {
  const { isAuthed } = useAuth();
  const loc = useLocation();
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/generos" element={<GenresPage />} />
        <Route path="/categorias-oscar" element={<OscarCategoriesPage />} />

        <Route path="/videos" element={<VideosPage />} />
        <Route path="/videos/nuevo" element={<VideoFormPage />} />
        <Route path="/videos/:id" element={<VideoDetailPage />} />
        <Route path="/videos/:id/editar" element={<VideoFormPage />} />

        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/clientes/nuevo" element={<ClientFormPage />} />
        <Route path="/clientes/:id" element={<ClientDetailPage />} />
        <Route path="/clientes/:id/editar" element={<ClientFormPage />} />

        <Route path="/prestamos" element={<LoansPage />} />
        <Route path="/prestamos/nuevo" element={<NewLoanPage />} />
        <Route path="/prestamos/:id" element={<LoanDetailPage />} />

        <Route path="/facturas" element={<InvoicesPage />} />
        <Route path="/configuracion" element={<ConfigPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
