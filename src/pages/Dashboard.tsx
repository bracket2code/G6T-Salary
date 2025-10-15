import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Worker } from '../types/salary';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Calculator, Users, Clock, DollarSign, FileText } from 'lucide-react';
import { formatDate } from '../lib/utils';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [recentWorkers, setRecentWorkers] = useState<Worker[]>([]);
  
  const handleNavigateToSection = (section: string) => {
    const searchParams = new URLSearchParams();
    
    switch (section) {
      case 'calculator':
        navigate('/calculator');
        break;
        break;
      case 'hours':
        navigate('/hours');
        break;
      case 'queries':
        navigate('/queries');
        break;
    }
  };
  
  const fetchDashboardStats = async () => {
    setIsLoading(true);
    try {
      // Mock data for demo
      const mockRecentWorkers: Worker[] = [
        {
          id: '1',
          name: 'Juan Pérez',
          email: 'juan@example.com',
          role: 'tecnico',
          phone: '+34 600 123 456',
          createdAt: new Date().toISOString(),
          updatedAt: null,
          avatarUrl: null,
          baseSalary: 1800,
          contractType: 'full_time',
          department: 'Mantenimiento'
        },
        {
          id: '2',
          name: 'María García',
          email: 'maria@example.com',
          role: 'supervisor',
          phone: '+34 600 789 012',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: null,
          avatarUrl: null,
          baseSalary: 2200,
          contractType: 'full_time',
          department: 'Recursos Humanos'
        },
        {
          id: '3',
          name: 'Carlos López',
          email: 'carlos@example.com',
          role: 'admin',
          phone: '+34 600 345 678',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          updatedAt: null,
          avatarUrl: null,
          baseSalary: 2800,
          contractType: 'full_time',
          department: 'Administración'
        }
      ];
      
      setRecentWorkers(mockRecentWorkers);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDashboardStats();
  }, []);
  
  return (
    <>
      <div className="space-y-6 pb-4">
        {/* Mobile: Single row with icons only */}
        <div className="md:hidden pt-4">
          <div className="flex justify-between gap-2 px-2">
            <div 
              className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
              onClick={() => handleNavigateToSection('calculator')}
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg mb-2">
                <Calculator size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Individual</p>
            </div>


            <div 
              className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
              onClick={() => handleNavigateToSection('hours')}
            >
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg mb-2">
                <Clock size={24} className="text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Horas Múltiple</p>
            </div>

            <div 
              className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border-0 p-4 cursor-pointer hover:shadow-md transition-all duration-200 flex flex-col items-center justify-center min-h-[80px]"
              onClick={() => handleNavigateToSection('queries')}
            >
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg mb-2">
                <FileText size={24} className="text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 text-center">Consultas</p>
            </div>
          </div>
        </div>

        {/* Desktop: Original grid layout */}
        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card 
            className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm cursor-pointer"
            onClick={() => handleNavigateToSection('calculator')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Cálculo Individual</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">Calculadora</p>
                </div>
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Calculator size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm cursor-pointer"
            onClick={() => handleNavigateToSection('hours')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Registro</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">Horas</p>
                </div>
                <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Clock size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-sm cursor-pointer"
            onClick={() => handleNavigateToSection('queries')}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Consultas</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">Trabajadores</p>
                </div>
                <div className="p-2 sm:p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <FileText size={20} className="text-orange-600 dark:text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Trabajadores Recientes</h2>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : recentWorkers.length === 0 ? (
              <div className="text-center py-6">
                <Users size={40} className="mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No hay trabajadores registrados</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentWorkers.slice(0, 5).map((worker) => (
                  <div 
                    key={worker.id} 
                    onClick={() => navigate('/queries')} 
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-3 sm:p-4 rounded-lg transition-colors duration-200"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 mt-1">
                        <Avatar name={worker.name} src={worker.avatarUrl} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                            {worker.name}
                          </p>
                          <span className="text-xs text-gray-500 dark:text-gray-400 self-start">
                            Registrado: {formatDate(worker.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Email: {worker.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          Rol: {worker.role === 'admin' ? 'Administrador' :
                                worker.role === 'supervisor' ? 'Supervisor' : 'Técnico'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};
