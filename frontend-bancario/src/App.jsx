import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Portal from './components/Portal';
import BandejaAgente from './components/BandejaAgente';
import PortalAdmin from './components/PortalAdmin';
import BandejaSupervisor from './components/BandejaSupervisor';
import BandejaJefe from './components/BandejaJefe';
import BandejaGerente from './components/BandejaGerente';

function App() {
  return (
    <Router>
      <Routes>
        {/* La vista principal ahora es la Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* El login tiene su propia ruta */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas por rol */}
        <Route path="/portal-usuario" element={<Portal onLogout={() => {
          localStorage.removeItem('token');
          localStorage.removeItem('rol');
          window.location.href = '/login'; // Redirigimos al login al salir
        }} />} />

        {/* Cambia la etiqueta <PortalAgente /> por <BandejaAgente /> */}
        <Route path="/bandeja-agente" element={<BandejaAgente onLogout={() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }} />} />

        <Route path="/admin-dashboard" element={<PortalAdmin onLogout={() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }} />} />

        <Route path="/bandeja-supervisor" element={<BandejaSupervisor onLogout={() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }} />} />

        <Route path="/bandeja-jefe" element={<BandejaJefe onLogout={() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }} />} />

        <Route path="/bandeja-gerente" element={<BandejaGerente onLogout={() => {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }} />} />

        {/* Ruta comodín de seguridad */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;