import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Calendar, CheckSquare as SquareCheckBig, BarChart2, Users, Settings, LogOut, Bell } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { useAuthStore } from '../../store/authStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';

const isMobile = () => window.innerWidth < 768;

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { isOpen, close, toggle } = useSidebarStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleNavigation = () => {
    if (isMobile()) {
      close();
    }
  };
  
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  
  if (!user) return null;

  const isActive = (path: string) => location.pathname === path;
  
  const navigationItems = [
    { path: '/', icon: LayoutGrid, label: 'Dashboard' },
    { path: '/tasks', icon: SquareCheckBig, label: 'Tareas' },
    { path: '/calendar', icon: Calendar, label: 'Calendario' },
    { path: '/reports', icon: BarChart2, label: 'Informes' },
    { path: '/settings', icon: Settings, label: 'Configuración' },
  ];
  
  return (
    <div className="h-full bg-white dark:bg-dark-800 border-r border-gray-200 dark:border-dark-600 flex flex-col transition-all duration-200 shadow-lg md:shadow-none">
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-dark-600">
        <div className={`${isOpen ? 'flex items-center' : 'w-full flex items-center justify-center'}`}>
          <SquareCheckBig size={24} className="text-blue-600 dark:text-blue-400" />
          <span className={`font-semibold text-gray-900 dark:text-white transition-all duration-200 ${isOpen ? 'ml-3 opacity-100' : 'opacity-0 w-0 overflow-hidden ml-0'}`}>
            G6T-Tasker
          </span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavigation}
            className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200
              ${isActive(item.path)
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-dark-700 dark:hover:text-white'}
            `}
          >
            <item.icon size={20} className={`flex-shrink-0 ${isOpen ? 'mr-3' : ''}`} />
            <span className={`${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 md:hidden'} whitespace-nowrap transition-all duration-200`}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>
      
      {/* User section */}
      <div className="mt-auto border-t border-gray-200 dark:border-dark-600">
        {/* Icons row */}
        <div className={`p-3 ${isOpen ? 'flex justify-between items-center' : 'flex flex-col items-center space-y-3'}`}>
          <Link
            to="/notifications"
            onClick={handleNavigation}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isActive('/notifications')
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-dark-700 dark:hover:text-white'
            }`}
          >
            <Bell size={18} />
          </Link>
          
          <div className="flex items-center justify-center">
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/profile')}
            >
              <Avatar name={user.name} size="sm" />
            </div>
          </div>
          
          <ThemeToggle />
        </div>
        
        {/* Copyright section */}
        {isOpen && (
          <div className="px-3 pb-3 text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              © 2025 Grupo6Tarifa.
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Todos los derechos reservados.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};