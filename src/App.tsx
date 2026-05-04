import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
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
import { NotificationsModal } from './components/NotificationsModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user && !isAdmin) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            <AuthProvider>
              <PWAInstallPrompt />
              <Header />
              <NotificationsModal />
              <main className="flex-1">
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
                </Routes>
              </main>
              <Footer />
            </AuthProvider>
          </div>
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
