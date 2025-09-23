import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useNotifications } from './hooks/useNotifications';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { CalendarPage } from './pages/CalendarPage';
import { TasksPage } from './pages/TasksPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ReportsPage } from './pages/ReportsPage';
import { WorkersPage } from './pages/WorkersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { Layout } from './components/layout/Layout';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';

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
  const { requestPermission } = useNotifications();
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [refreshDashboard, setRefreshDashboard] = React.useState(0);
  
  useEffect(() => {
    checkSession();
    
    // Solicitar permisos de notificación después de un breve delay
    setTimeout(() => {
      requestPermission();
    }, 2000);
    
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
              <Layout onNewTaskClick={() => setShowCreateModal(true)} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard key={refreshDashboard} />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="tasks/:id" element={<div>Detalles de Tarea (Próximamente)</div>} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          setRefreshDashboard(prev => prev + 1);
        }}
      />
    </BrowserRouter>
  );
}

export default App;