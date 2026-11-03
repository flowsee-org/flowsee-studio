import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { NotificationProvider } from '@/lib/NotificationContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/Layout';
import AdminRoute from '@/components/AdminRoute';
import ModuleRoute from '@/components/ModuleRoute';
import Admin from '@/pages/Admin';
import WebsiteMessages from '@/pages/WebsiteMessages';
import SiteContent from '@/pages/SiteContent';
import BlogContent from '@/pages/BlogContent';
import Dashboard from '@/pages/Dashboard';
import Accounting from '@/pages/Accounting';
import Reports from '@/pages/Reports';
import Meetings from '@/pages/Meetings';
import Tasks from '@/pages/Tasks';
import Projects from '@/pages/Projects';
import WorkReports from '@/pages/WorkReports';
import Employees from '@/pages/Employees';
import Profile from '@/pages/Profile';
import ProjectDetail from '@/pages/ProjectDetail';
import Announcements from '@/pages/Announcements';
import Sprints from '@/pages/Sprints';
import LeaveRequests from '@/pages/LeaveRequests';
import AppSettings from '@/pages/AppSettings';
import DailyReportReminder from '@/hooks/useDailyReportReminder.jsx';
import ErrorBoundary from '@/components/ErrorBoundary';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const isPublicAuthPage = ['/login', '/register', '/forgot-password', '/reset-password']
    .includes(window.location.pathname.replace(/\/$/, '') || '/');

  // When the backend reports auth is required, redirect to the login page.
  // Done in an effect (not during render) because it performs a navigation.
  useEffect(() => {
    // Auth pages must remain reachable when the app's public-settings endpoint
    // reports that authentication is required. Redirecting from /login back to
    // /login makes the SDK nest from_url repeatedly until nginx returns 414.
    if (authError?.type === 'auth_required' && !isPublicAuthPage) {
      navigateToLogin();
    }
  }, [authError, isPublicAuthPage, navigateToLogin]);

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered' || authError.type === 'user_deactivated') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required' && !isPublicAuthPage) {
      // The redirect effect above handles this case; await it.
      return null;
    }
  }

  // Render the main app
  return (
    <ErrorBoundary>
      <>
        <DailyReportReminder />
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/work-reports" element={<WorkReports />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/sprints" element={<Sprints />} />
            <Route path="/leave-requests" element={<LeaveRequests />} />
            <Route path="/settings" element={<AppSettings />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route element={<ModuleRoute module="website-messages" />}>
              <Route path="/website-messages" element={<WebsiteMessages />} />
            </Route>
            <Route element={<ModuleRoute module="site-content" />}>
              <Route path="/site-content" element={<SiteContent />} />
            </Route>
            <Route element={<ModuleRoute module="blog-content" />}>
              <Route path="/blog-content" element={<BlogContent />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      </>
    </ErrorBoundary>
  );
};


function App() {

  return (
    <AuthProvider>
      <NotificationProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
