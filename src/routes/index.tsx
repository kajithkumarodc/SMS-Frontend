import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/login" element={<div>Login placeholder</div>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<div>App layout placeholder</div>}>
          <Route path="dashboard" element={<div>Dashboard placeholder</div>} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
