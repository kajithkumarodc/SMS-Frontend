import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import AppLayout from '../components/AppLayout';
import { LoginForm } from '../features/auth';
import { DashboardPage } from '../features/dashboard';
import { BulkDeletePage, StudentsPage, StudentAdmissionPage, StudentImportPage, StudentProfilePage } from '../features/students';
import { ClassesPage } from '../features/classes';
import { AttendancePage } from '../features/attendance';
import { ExamsPage } from '../features/exams';
import { FeesPage, FeesMasterPage, CollectFeesPage, StudentFeesPage } from '../features/fees';
import { ReportsPage } from '../features/reports';
import { AnnouncementsPage } from '../features/announcements';
import { LibraryPage } from '../features/library';
import { TransportPage } from '../features/transport';
import { HostelPage } from '../features/hostel';
import { AddStaffPage, ApplyLeavePage, ApproveLeavePage, ImportStaffPage, LeaveTypePage, RateTeachersPage, StaffAttendancePage, StaffDirectoryPage, StaffProfilePage, TeachersRatingPage } from '../features/staff';
import { EditPayrollPage, PayrollPage } from '../features/payroll';
import { SettingsPage } from '../features/settings';
import {
  FrontOfficePage,
  EnquiriesPage,
  VisitorBookPage,
  PhoneCallLogPage,
  PostalDispatchPage,
  PostalReceivePage,
  ComplaintPage,
  FrontOfficeSetupPage,
} from '../features/frontoffice';
import { AddExpensePage, ExpenseHeadPage, SearchExpensePage } from '../features/expenses';
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
import { hasRole, ROLE } from '../lib/roles';
import ComingSoonPage from '../components/ComingSoonPage';

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

/** Old page URL that moved into a menu group -- keeps bookmarks, links and `?...` filters working. */
function MovedTo({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
}

const STUDENT_INFO = 'Student Information';

function StudentInfoComingSoon({ title, description }: { title: string; description: string }) {
  const isAdmin = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);
  return <ComingSoonPage section={STUDENT_INFO} title={title} description={description} canView={isAdmin} />;
}

function FeesComingSoon({ title, description }: { title: string; description: string }) {
  const isAdmin = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);
  return <ComingSoonPage section="Fees Collection" title={title} description={description} canView={isAdmin} />;
}

function HumanResourceComingSoon({ title, description }: { title: string; description: string }) {
  const isAdmin = hasRole(useAuthStore((state) => state.user?.roles), ROLE.SCHOOL_ADMIN);
  return <ComingSoonPage section="Human Resource" title={title} description={description} canView={isAdmin} />;
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
          <Route path="students" element={<MovedTo to="/app/student-information/student-details" />} />
          <Route path="student-information">
            <Route index element={<Navigate to="student-details" replace />} />
            <Route path="student-details" element={<StudentsPage key="details" />} />
            <Route path="student-details/:studentId" element={<StudentProfilePage />} />
            <Route path="student-admission" element={<StudentAdmissionPage />} />
            <Route path="student-admission/import" element={<StudentImportPage />} />
            <Route path="online-admission" element={<AdmissionsPage />} />
            <Route path="admission-cycles" element={<AdmissionCyclesPage />} />
            <Route
              path="disabled-students"
              element={<StudentInfoComingSoon title="Disabled Students" description="Students who have been disabled, with the reason, and the option to enable them again." />}
            />
            <Route
              path="multi-class-student"
              element={<StudentInfoComingSoon title="Multi Class Student" description="Place one student in more than one class or section at the same time." />}
            />
            <Route
              path="bulk-delete"
              element={<BulkDeletePage />}
            />
            <Route
              path="student-categories"
              element={<StudentInfoComingSoon title="Student Categories" description="Manage student categories (for example General, OBC, SC, ST) used on the admission form." />}
            />
            <Route
              path="student-house"
              element={<StudentInfoComingSoon title="Student House" description="Manage the school houses students are grouped into." />}
            />
            <Route
              path="disable-reason"
              element={<StudentInfoComingSoon title="Disable Reason" description="Manage the reasons that can be chosen when a student is disabled." />}
            />
          </Route>
          <Route path="classes" element={<ClassesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="fees-collection">
            <Route index element={<Navigate to="collect-fees" replace />} />
            <Route path="collect-fees" element={<CollectFeesPage />} />
            <Route path="collect-fees/:studentId" element={<StudentFeesPage />} />
            <Route
              path="offline-bank-payments"
              element={<FeesComingSoon title="Offline Bank Payments" description="Review fee payments that parents report as made by bank transfer or deposit, and approve or reject them." />}
            />
            <Route
              path="search-fees-payment"
              element={<FeesComingSoon title="Search Fees Payment" description="Find a fee payment by its payment ID and view or print its receipt." />}
            />
            <Route
              path="search-due-fees"
              element={<FeesComingSoon title="Search Due Fees" description="List students with unpaid fees by class, section and fee group." />}
            />
            <Route path="fees-master" element={<FeesMasterPage />} />
            <Route
              path="quick-fees"
              element={<FeesComingSoon title="Quick Fees" description="Set up a student's fees for the year in a few steps, split into instalments." />}
            />
            <Route
              path="fees-group"
              element={<FeesComingSoon title="Fees Group" description="Group fee types together (for example Class 1 General) so they can be assigned in one go." />}
            />
            <Route path="fees-type" element={<FeesPage key="types" section="types" />} />
            <Route path="fees-discount" element={<FeesPage key="discounts" section="discounts" />} />
            <Route
              path="fees-carry-forward"
              element={<FeesComingSoon title="Fees Carry Forward" description="Move unpaid balances from the previous session into the new one." />}
            />
            <Route
              path="fees-reminder"
              element={<FeesComingSoon title="Fees Reminder" description="Send fee due reminders to parents before and after the due date." />}
            />
          </Route>
          <Route path="expenses">
            <Route index element={<Navigate to="add-expense" replace />} />
            <Route path="add-expense" element={<AddExpensePage />} />
            <Route path="search-expense" element={<SearchExpensePage />} />
            <Route path="expense-head" element={<ExpenseHeadPage />} />
          </Route>
          <Route path="fees" element={<MovedTo to="/app/fees-collection/fees-master" />} />
          <Route path="fee-collection" element={<MovedTo to="/app/fees-collection/collect-fees" />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="announcements" element={<AnnouncementsPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="transport" element={<TransportPage />} />
          <Route path="hostel" element={<HostelPage />} />
          <Route path="staff" element={<MovedTo to="/app/human-resource/payroll" />} />
          <Route path="leave-requests" element={<MovedTo to="/app/human-resource/approve-leave-request" />} />
          <Route path="human-resource">
            <Route index element={<Navigate to="staff-directory" replace />} />
            <Route path="staff-directory" element={<StaffDirectoryPage />} />
            <Route path="staff-directory/add" element={<AddStaffPage />} />
            <Route path="staff-directory/import" element={<ImportStaffPage />} />
            <Route path="staff-directory/:staffId/edit" element={<AddStaffPage />} />
            <Route path="staff-directory/:staffId" element={<StaffProfilePage />} />
            <Route path="staff-attendance" element={<StaffAttendancePage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="payroll/:payrollId/edit" element={<EditPayrollPage />} />
            <Route path="approve-leave-request" element={<ApproveLeavePage />} />
            <Route path="apply-leave" element={<ApplyLeavePage />} />
            <Route path="leave-type" element={<LeaveTypePage />} />
            <Route path="teachers-rating" element={<TeachersRatingPage />} />
            <Route
              path="department"
              element={<HumanResourceComingSoon title="Department" description="Manage the departments staff are assigned to." />}
            />
            <Route
              path="designation"
              element={<HumanResourceComingSoon title="Designation" description="Manage the designations staff can hold." />}
            />
            <Route
              path="disabled-staff"
              element={<HumanResourceComingSoon title="Disabled Staff" description="Staff who have been disabled, with the option to enable them again." />}
            />
          </Route>
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
            <Route path="setup" element={<FrontOfficeSetupPage />} />
          </Route>
          <Route path="enquiries" element={<EnquiriesRedirect />} />
          <Route path="admissions" element={<MovedTo to="/app/student-information/online-admission" />} />
          <Route path="admission-cycles" element={<MovedTo to="/app/student-information/admission-cycles" />} />
          <Route path="my-teachers" element={<RateTeachersPage />} />
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
