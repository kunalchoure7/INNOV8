import { useCallback, useEffect, useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { BookTokenPage } from './pages/BookTokenPage';
import { MyTokensPage } from './pages/MyTokensPage';
import { LiveDisplayPage } from './pages/LiveDisplayPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

function AppRouter() {
  const [locationPath, setLocationPath] = useState(
    () => window.location.pathname + window.location.search
  );

  useEffect(() => {
    const onPopState = () => {
      setLocationPath(window.location.pathname + window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path === window.location.pathname + window.location.search) return;
    window.history.pushState({}, '', path);
    setLocationPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const pathname = locationPath.split('?')[0];

  const renderPage = () => {
    if (pathname === '/book') {
      return <BookTokenPage onNavigate={navigate} />;
    }
    if (pathname === '/my-tokens') {
      return <MyTokensPage onNavigate={navigate} />;
    }
    if (pathname === '/display' || pathname.startsWith('/display/')) {
      const slug = pathname.startsWith('/display/')
        ? pathname.replace('/display/', '')
        : undefined;
      return <LiveDisplayPage initialSlug={slug} onNavigate={navigate} />;
    }
    if (pathname === '/admin') {
      return <AdminDashboardPage onNavigate={navigate} />;
    }
    return <LandingPage onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen bg-[#D9F3FF] text-[#101828] overflow-x-hidden">
      <Navbar currentPath={pathname} onNavigate={navigate} />
      <main>{renderPage()}</main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
