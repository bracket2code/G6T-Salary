import React, { Suspense, useEffect, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { Layout } from './components/layout/Layout';

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage }))
);
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((module) => ({ default: module.Dashboard }))
);
const SalaryCalculatorPage = lazy(() =>
  import('./pages/SalaryCalculatorPage').then((module) => ({
    default: module.SalaryCalculatorPage,
  }))
);
const MultipleCalculatorPage = lazy(() =>
  import('./pages/MultipleCalculatorPage').then((module) => ({
    default: module.MultipleCalculatorPage,
  }))
);
const HoursRegistryPage = lazy(() =>
  import('./pages/HoursRegistryPage').then((module) => ({
    default: module.HoursRegistryPage,
  }))
);
const WorkerQueriesPage = lazy(() =>
  import('./pages/WorkerQueriesPage').then((module) => ({
    default: module.WorkerQueriesPage,
  }))
);
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((module) => ({
    default: module.ProfilePage,
  }))
);
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));

// Route guard component
const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
  </div>
);

const withPageLoader = (node: React.ReactElement) => (
  <Suspense fallback={<PageLoader />}>{node}</Suspense>
);

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { checkSession, refreshSession } = useAuthStore();
  const [refreshDashboard, setRefreshDashboard] = React.useState(0);
  
  useEffect(() => {
    checkSession();
    
    // Configurar refresh automático del token cada 50 minutos
    const refreshInterval = setInterval(() => {
      refreshSession();
    }, 50 * 60 * 1000); // 50 minutos
    
    return () => clearInterval(refreshInterval);
  }, [checkSession]);
  
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={withPageLoader(<LoginPage />)} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={withPageLoader(<Dashboard key={refreshDashboard} />)} />
          <Route path="calculator" element={withPageLoader(<SalaryCalculatorPage />)} />
          <Route path="multiple" element={withPageLoader(<MultipleCalculatorPage />)} />
          <Route path="hours" element={withPageLoader(<HoursRegistryPage />)} />
          <Route path="hours/multiple" element={<Navigate to="/hours" replace />} />
          <Route path="registro" element={<Navigate to="/hours" replace />} />
          <Route path="log" element={<Navigate to="/hours" replace />} />
          <Route path="timesheet" element={<Navigate to="/hours" replace />} />
          <Route path="queries" element={withPageLoader(<WorkerQueriesPage />)} />
          <Route path="reports" element={withPageLoader(<ReportsPage />)} />
          <Route path="templates" element={withPageLoader(<TemplatesPage />)} />
          <Route path="profile" element={withPageLoader(<ProfilePage />)} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
