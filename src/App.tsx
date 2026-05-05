import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { HomePage } from './pages/HomePage';
import { AboutPage } from './pages/AboutPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { VolunteerPage } from './pages/VolunteerPage';
import { DonatePage } from './pages/DonatePage';
import { ContactPage } from './pages/ContactPage';
import { MembershipPage } from './pages/MembershipPage';
import { LessonsPage } from './pages/LessonsPage';
import { AuthPage } from './pages/AuthPage';
import { AdminPage } from './pages/AdminPage';
import { AccountPage } from './pages/AccountPage';
import { NotificationsModal } from './components/NotificationsModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

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
          جاري تجهيز بيئة العمل...
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Please wait while we verify your session</p>
      </div>
    );
  }

  if (!user && !isAdmin) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {!isAuthPage && <PWAInstallPrompt />}
      {!isAuthPage && <Header />}
      {!isAuthPage && <NotificationsModal />}
      <main className={`flex-1 ${!isAuthPage ? 'pb-16' : ''}`}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/volunteer" element={<ProtectedRoute><VolunteerPage /></ProtectedRoute>} />
          <Route path="/membership" element={<ProtectedRoute><MembershipPage /></ProtectedRoute>} />
          <Route path="/donate" element={<ProtectedRoute><DonatePage /></ProtectedRoute>} />
          <Route path="/contact" element={<ProtectedRoute><ContactPage /></ProtectedRoute>} />
          <Route path="/lessons" element={<ProtectedRoute><LessonsPage /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
        </Routes>
      </main>
      {!isAuthPage && <BottomNav />}
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
