import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import AppLayout from '../components/AppLayout';
import { LoginForm } from '../features/auth';
import { DashboardPage } from '../features/dashboard';
import { StudentsPage } from '../features/students';
import { ClassesPage } from '../features/classes';
import { AttendancePage } from '../features/attendance';
import { ExamsPage } from '../features/exams';
import { FeesPage, FeeCollectionPage } from '../features/fees';
import { ReportsPage } from '../features/reports';
import { AnnouncementsPage } from '../features/announcements';
import { LibraryPage } from '../features/library';
import { TransportPage } from '../features/transport';
import { HostelPage } from '../features/hostel';
import { StaffPage, LeaveRequestsPage } from '../features/staff';
import { SettingsPage } from '../features/settings';
import {
  FrontOfficePage,
  EnquiriesPage,
  FrontOfficePlaceholderPage,
  VisitorBookPage,
  PhoneCallLogPage,
  PostalDispatchPage,
  PostalReceivePage,
  ComplaintPage,
} from '../features/frontoffice';
import { PromotionPage } from '../features/promotion';
import { AdmissionsPage, AdmissionCyclesPage } from '../features/admissions';
import { AdmissionApplyPage, AdmissionStatusPage, ActivateAccountPage } from '../features/admissions-public';
import {
  MyAttendancePage,
  ChildAttendancePage,
  MyResultsPage,
  ChildResultsPage,
  ChildInvoicesPage,
  MyLibraryPage,
  ChildLibraryPage,
  MyTransportPage,
  ChildTransportPage,
  MyHostelPage,
  ChildHostelPage,
  MyProfilePage,
} from '../features/portal';
import { useAuthStore } from '../store/authStore';

function LoginRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <LoginForm />;
}

/** Old enquiries URL -- keeps bookmarks and `?sourceId=`/`?classId=` filters working. */
function EnquiriesRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/app/front-office/admission-enquiry${search}`} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/admissions/apply" element={<AdmissionApplyPage />} />
      <Route path="/admissions/status" element={<AdmissionStatusPage />} />
      <Route path="/activate" element={<ActivateAccountPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="fees" element={<FeesPage />} />
          <Route path="fee-collection" element={<FeeCollectionPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="transport" element={<TransportPage />} />
          <Route path="hostel" element={<HostelPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="leave-requests" element={<LeaveRequestsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="promotion" element={<PromotionPage />} />
          <Route path="front-office">
            <Route index element={<FrontOfficePage />} />
            <Route path="admission-enquiry" element={<EnquiriesPage />} />
            <Route path="visitor-book" element={<VisitorBookPage />} />
            <Route path="phone-call-log" element={<PhoneCallLogPage />} />
            <Route path="postal-dispatch" element={<PostalDispatchPage />} />
            <Route path="postal-receive" element={<PostalReceivePage />} />
            <Route path="complaints" element={<ComplaintPage />} />
            <Route
              path="setup"
              element={<FrontOfficePlaceholderPage title="Setup Front Office" description="Manage the lists used across Front Office: purposes, complaint types, sources and references." />}
            />
          </Route>
          <Route path="enquiries" element={<EnquiriesRedirect />} />
          <Route path="admissions" element={<AdmissionsPage />} />
          <Route path="admission-cycles" element={<AdmissionCyclesPage />} />
          <Route path="my-profile" element={<MyProfilePage />} />
          <Route path="my-attendance" element={<MyAttendancePage />} />
          <Route path="my-results" element={<MyResultsPage />} />
          <Route path="my-library" element={<MyLibraryPage />} />
          <Route path="my-transport" element={<MyTransportPage />} />
          <Route path="my-hostel" element={<MyHostelPage />} />
          <Route path="children/:studentId/attendance" element={<ChildAttendancePage />} />
          <Route path="children/:studentId/results" element={<ChildResultsPage />} />
          <Route path="children/:studentId/invoices" element={<ChildInvoicesPage />} />
          <Route path="children/:studentId/library" element={<ChildLibraryPage />} />
          <Route path="children/:studentId/transport" element={<ChildTransportPage />} />
          <Route path="children/:studentId/hostel" element={<ChildHostelPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRoutes;
