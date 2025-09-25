import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, Landmark } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useSidebarStore } from '../../store/sidebarStore';
import { Button } from '../ui/Button';

const isMobile = () => window.innerWidth < 768;

export const Layout: React.FC = () => {
  const { isOpen, toggle, setInitialState } = useSidebarStore();
  const [clickCount, setClickCount] = React.useState(0);
  const [showClickProgress, setShowClickProgress] = React.useState(false);
  const [isReloading, setIsReloading] = React.useState(false);
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const sidebarWidth = isOpen ? 'w-64' : 'w-16';

  useEffect(() => {
    const handleResize = () => {
      setInitialState();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setInitialState]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Close sidebar when clicking outside on mobile
  const handleOverlayClick = () => {
    if (isMobile()) {
      toggle();
    }
  };

  const handleReload = async () => {
    try {
      // Save timestamp of last update
      localStorage.setItem('last_data_update', new Date().toISOString());
      
      // Clear Service Worker cache
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      
      // Clear browser cache
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Reload the page
      window.location.reload();
    } catch (error) {
      console.error('Error during reload:', error);
      // Fallback: simple reload
      window.location.reload();
    }
  };

  const handleLogoClick = () => {
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);
    setShowClickProgress(true);
    
    // Clear existing timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    
    // Check if we've reached 7 clicks
    if (newClickCount >= 7) {
      setClickCount(0);
      setShowClickProgress(false);
      setIsReloading(true);
      handleReload();
      return;
    }
    
    // Set timeout to reset click count after 3 seconds
    clickTimeoutRef.current = setTimeout(() => {
      setClickCount(0);
      setShowClickProgress(false);
    }, 3000);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200 overflow-hidden w-full">
      {/* Mobile overlay */}
      {isOpen && isMobile() && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={handleOverlayClick}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-30 ${sidebarWidth}
          transform ${isMobile() ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
          md:static md:z-auto md:transform-none
          transition-transform duration-300 ease-in-out
          h-screen
        `}
      >
        <Sidebar />
      </div>
      
      <div className="flex-1 min-h-screen flex flex-col transition-all duration-300 min-w-0 overflow-hidden">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-700 border-b border-gray-200 dark:border-dark-600 px-4 py-3 flex items-center justify-center flex-shrink-0 pt-safe-top min-h-[64px]">
          <Button
            aria-label="Toggle sidebar"
            size="sm"
            variant="ghost"
            onClick={toggle}
            className="hover:bg-gray-100 dark:hover:bg-dark-700 absolute left-4"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-300" />
          </Button>
          
          <div className="flex flex-col items-center justify-center">
            <div 
              className="flex items-center space-x-2 justify-center cursor-pointer select-none"
              onClick={handleLogoClick}
            >
              <Landmark 
                size={20} 
                className={`text-blue-600 dark:text-blue-400 transition-transform duration-200 ${
                  isReloading ? 'animate-spin' : ''
                }`} 
              />
              <h1 className="font-semibold text-gray-900 dark:text-white text-xl">
                G6T-Salary
              </h1>
            </div>
            
            {/* Progress bar */}
            {showClickProgress && (
              <div className="w-24 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mt-1 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300 ease-out"
                  style={{ width: `${(clickCount / 7) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>
        <main className="flex-1 w-full min-w-0 overflow-y-auto">
          <div className="max-w-[100rem] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 h-full">
          <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
