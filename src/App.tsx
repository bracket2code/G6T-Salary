import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useNotifications } from './hooks/useNotifications';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { SalaryCalculatorPage } from './pages/SalaryCalculatorPage';
import { MultipleCalculatorPage } from './pages/MultipleCalculatorPage';
import { MultipleHoursRegistryPage } from './pages/MultipleHoursRegistryPage';
import { WorkerQueriesPage } from './pages/WorkerQueriesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProfilePage } from './pages/ProfilePage';
import TemplatesPage from './pages/TemplatesPage';
import { Layout } from './components/layout/Layout';

// Route guard component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
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
        <Route path="/login" element={<LoginPage />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard key={refreshDashboard} />} />
          <Route path="calculator" element={<SalaryCalculatorPage />} />
          <Route path="multiple" element={<MultipleCalculatorPage />} />
          <Route path="hours" element={<MultipleHoursRegistryPage />} />
          <Route path="hours/multiple" element={<Navigate to="/hours" replace />} />
          <Route path="registro" element={<Navigate to="/hours" replace />} />
          <Route path="log" element={<Navigate to="/hours" replace />} />
          <Route path="timesheet" element={<Navigate to="/hours" replace />} />
          <Route path="queries" element={<WorkerQueriesPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
