import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import AppLayout from '../components/AppLayout';
import { LoginForm } from '../features/auth';
import { DashboardPage } from '../features/dashboard';
import { StudentsPage } from '../features/students';
import { ClassesPage } from '../features/classes';
import { AttendancePage } from '../features/attendance';
import { ExamsPage } from '../features/exams';
import { FeesPage } from '../features/fees';
import { ReportsPage } from '../features/reports';
import { AnnouncementsPage } from '../features/announcements';
import { LibraryPage } from '../features/library';
import {
  MyAttendancePage,
  ChildAttendancePage,
  MyResultsPage,
  ChildResultsPage,
  ChildInvoicesPage,
  MyLibraryPage,
  ChildLibraryPage,
} from '../features/portal';
import { useAuthStore } from '../store/authStore';

function LoginRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <LoginForm />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="fees" element={<FeesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="my-attendance" element={<MyAttendancePage />} />
          <Route path="my-results" element={<MyResultsPage />} />
          <Route path="my-library" element={<MyLibraryPage />} />
          <Route path="children/:studentId/attendance" element={<ChildAttendancePage />} />
          <Route path="children/:studentId/results" element={<ChildResultsPage />} />
          <Route path="children/:studentId/invoices" element={<ChildInvoicesPage />} />
          <Route path="children/:studentId/library" element={<ChildLibraryPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
