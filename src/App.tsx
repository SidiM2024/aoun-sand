import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
const AboutPage = lazy(() => import('./pages/AboutPage').then(module => ({ default: module.AboutPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(module => ({ default: module.ProjectsPage })));
const DonatePage = lazy(() => import('./pages/DonatePage').then(module => ({ default: module.DonatePage })));
const ContactPage = lazy(() => import('./pages/ContactPage').then(module => ({ default: module.ContactPage })));
const LessonsPage = lazy(() => import('./pages/LessonsPage').then(module => ({ default: module.LessonsPage })));
const DonationExpensesPage = lazy(() => import('./pages/DonationExpensesPage').then(module => ({ default: module.DonationExpensesPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then(module => ({ default: module.AuthPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then(module => ({ default: module.AccountPage })));
const UserRequestsPage = lazy(() => import('./pages/UserRequestsPage').then(module => ({ default: module.UserRequestsPage })));
const MahajaDashboard = lazy(() => import('./pages/MahajaDashboard').then(module => ({ default: module.MahajaDashboard })));
const MahajaCoursePage = lazy(() => import('./pages/MahajaCoursePage').then(module => ({ default: module.MahajaCoursePage })));
import { NotificationsModal } from './components/NotificationsModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
// import { usePushNotifications } from './hooks/usePushNotifications';
import { useLanguage } from './contexts/LanguageContext';
import { Clock, XCircle, Ban, LogOut } from 'lucide-react';
import { AvatarPromptModal } from './components/AvatarPromptModal';
const VerifyCardPage = lazy(() => import('./pages/VerifyCardPage').then(module => ({ default: module.VerifyCardPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then(module => ({ default: module.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage').then(module => ({ default: module.TermsOfServicePage })));
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {

  const { user, userProfile, loading, isAdmin, logout } = useAuth();
  const { language } = useLanguage();
  const location = useLocation();
  const isRTL = language === 'ar';

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="relative w-24 h-24 flex items-center justify-center mb-8">
          <div className="absolute inset-0 rounded-full border-t-4 border-indigo-600 dark:border-indigo-400 animate-spin opacity-75"></div>
          <div className="absolute inset-2 rounded-full border-r-4 border-teal-500 dark:border-teal-400 animate-spin-slow opacity-75"></div>
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-teal-400 rounded-full animate-pulse"></div>
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-teal-500">
          {isRTL ? 'جاري تجهيز بيئة العمل...' : 'Preparing workspace...'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Please wait while we verify your session</p>
      </div>
    );
  }

  if (!user && !isAdmin) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Intercept users without an avatar
  if (user && !isAdmin && userProfile && !userProfile.avatar_url) {
    return <AvatarPromptModal />;
  }

  // Intercept Mahaja users to isolate them to /mahaja
  if (user && !isAdmin && userProfile?.is_mahaja) {
    if (location.pathname !== '/mahaja' && !location.pathname.startsWith('/mahaja/course/') && location.pathname !== '/account') {
      return <Navigate to="/mahaja" replace />;
    }
    return <>{children}</>;
  }

  // Intercept normal users who are not approved
  if (user && !isAdmin) {
    const status = userProfile?.approval_status || 'Pending Approval';

    if (status !== 'Approved') {
      let title = '';
      let message = '';
      let Icon = Clock;
      let colorClass = 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';

      if (status === 'Pending Approval') {
        title = isRTL ? 'قيد الانتظار' : 'Awaiting Approval';
        message = isRTL 
          ? 'حسابك في انتظار موافقة المسؤول.'
          : 'Your account is awaiting administrator approval.';
        Icon = Clock;
        colorClass = 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
      } else if (status === 'Rejected') {
        title = isRTL ? 'تم رفض الحساب' : 'Account Rejected';
        message = isRTL 
          ? 'لقد تم رفض طلب التسجيل الخاص بك.'
          : 'Your registration request has been rejected.';
        Icon = XCircle;
        colorClass = 'text-red-500 bg-red-50 dark:bg-red-900/20';
      } else if (status === 'Suspended') {
        title = isRTL ? 'تم تعليق الحساب' : 'Account Suspended';
        message = isRTL 
          ? 'تم تعليق حسابك.' 
          : 'Your account has been suspended.';
        Icon = Ban;
        colorClass = 'text-rose-500 bg-rose-50 dark:bg-rose-900/20';
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-8 border border-slate-200 dark:border-slate-800 text-center space-y-6">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-lg ${colorClass}`}>
              <Icon className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 dark:text-white">
                {title}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                {message}
              </p>
            </div>

            <button 
              onClick={logout}
              className="w-full py-4 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              <span>{isRTL ? 'تسجيل الخروج' : 'Log Out'}</span>
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

const AppContent = () => {
  const location = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const isAuthPage = location.pathname === '/auth';
  // Admin page also hides all user-facing chrome (Header, Nav, Notifications)
  // to prevent context leakage and unnecessary queries during admin sessions
  const isAdminPage = location.pathname === '/admin';
  const { userProfile } = useAuth();
  const isMahajaUser = userProfile?.is_mahaja === true;
  const isShellHidden = isAuthPage || isAdminPage || isMahajaUser;

  // Register service worker + listen for push notifications via Supabase Realtime
  // Push notifications removed to revert back to standard website behavior

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {!isShellHidden && <Header />}
      {!isShellHidden && <NotificationsModal />}
      <Toaster position="top-center" />
      <main className={`flex-1 ${!isShellHidden ? 'website-main' : ''}`}>
        <Suspense fallback={<div role="status" className="container-custom py-48 text-center">جارٍ التحميل… / Loading…</div>}>
        <Routes>
          <Route path="/volunteer" element={<Navigate to="/contact" replace />} />
          <Route path="/membership" element={<Navigate to="/account" replace />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/verify-card/:id" element={<VerifyCardPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsOfServicePage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/donate" element={<DonatePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/lessons" element={<LessonsPage />} />
          <Route path="/mahaja" element={<ProtectedRoute><MahajaDashboard /></ProtectedRoute>} />
          <Route path="/mahaja/course/:id" element={<ProtectedRoute><MahajaCoursePage /></ProtectedRoute>} />
          <Route path="/donation-expenses" element={<ProtectedRoute><DonationExpensesPage /></ProtectedRoute>} />
          <Route path="/requests" element={<ProtectedRoute><UserRequestsPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
          <Route path="*" element={<div className="container-custom py-32 text-center"><h1 className="section-title">404</h1><p>الصفحة غير موجودة / Page not found</p><a href="/" className="btn-primary mt-6">الرئيسية / Home</a></div>} />
        </Routes>
        </Suspense>
      </main>
      {!isShellHidden && <Footer />}
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </QueryClientProvider>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
