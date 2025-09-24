import React, { useState, useEffect } from 'react';
import { Search, Users, FileText, DollarSign, Calendar, Phone, Mail, Building2, User } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Avatar } from '../components/ui/Avatar';
import { Worker, Contract } from '../types/salary';
import { formatDate } from '../lib/utils';

// Mock workers data
const mockWorkers: Worker[] = [
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
    hourlyRate: 12,
    contractType: 'full_time',
    department: 'Mantenimiento',
    position: 'Técnico Senior'
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
    hourlyRate: 15,
    contractType: 'full_time',
    department: 'Recursos Humanos',
    position: 'Supervisora'
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
    hourlyRate: 18,
    contractType: 'full_time',
    department: 'Administración',
    position: 'Administrador'
  }
];

export const WorkerQueriesPage: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [workerContracts, setWorkerContracts] = useState<Contract[]>([]);

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [searchQuery, filterRole]);

  useEffect(() => {
    if (selectedWorker) {
      fetchWorkerContracts(selectedWorker.id);
    }
  }, [selectedWorker]);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter workers based on search query and role
      let filteredWorkers = mockWorkers;
      
      if (searchQuery) {
        filteredWorkers = filteredWorkers.filter(worker =>
          worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          worker.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      if (filterRole) {
        filteredWorkers = filteredWorkers.filter(worker => worker.role === filterRole);
      }
      
      setWorkers(filteredWorkers);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWorkerContracts = async (workerId: string) => {
    try {
      // Mock contracts data
      const mockContracts: Contract[] = [
        {
          id: '1',
          workerId: workerId,
          contractType: 'full_time',
          baseSalary: 1800,
          hourlyRate: 12,
          startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          department: 'Mantenimiento',
          position: 'Técnico Senior',
          benefits: ['Seguro médico', 'Vacaciones pagadas', 'Bonos por rendimiento'],
          isActive: true,
          createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];
      
      setWorkerContracts(mockContracts);
    } catch (error) {
      console.error('Error fetching worker contracts:', error);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'supervisor':
        return 'Supervisor';
      case 'tecnico':
        return 'Técnico';
      default:
        return 'Usuario';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Consultas de Trabajadores"
        description="Consulta información detallada de trabajadores, contratos y sueldos"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workers List */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Users size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
              Lista de Trabajadores
            </h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="space-y-3">
              <Input
                placeholder="Buscar por nombre o email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={18} />}
                fullWidth
              />

              <Select
                label="Filtrar por rol"
                value={filterRole}
                onChange={setFilterRole}
                options={[
                  { value: '', label: 'Todos los roles' },
                  { value: 'admin', label: 'Administrador' },
                  { value: 'supervisor', label: 'Supervisor' },
                  { value: 'tecnico', label: 'Técnico' }
                ]}
                fullWidth
              />
            </div>

            {/* Workers List */}
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : workers.length === 0 ? (
              <div className="text-center py-8">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  {searchQuery || filterRole ? 'No se encontraron trabajadores' : 'No hay trabajadores registrados'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {workers.map((worker) => (
                  <div
                    key={worker.id}
                    onClick={() => setSelectedWorker(worker)}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedWorker?.id === worker.id
                        ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar name={worker.name} src={worker.avatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {worker.name}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {worker.email}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {getRoleDisplayName(worker.role)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Worker Details */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <FileText size={20} className="mr-2 text-green-600 dark:text-green-400" />
              Detalles del Trabajador
            </h2>
          </CardHeader>
          <CardContent>
            {!selectedWorker ? (
              <div className="text-center py-8">
                <User size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Selecciona un trabajador para ver sus detalles
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <User size={16} className="mr-2" />
                    Información Personal
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Avatar name={selectedWorker.name} src={selectedWorker.avatarUrl} size="lg" />
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedWorker.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {getRoleDisplayName(selectedWorker.role)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-center space-x-2 text-sm">
                        <Mail size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">Email:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedWorker.email}
                        </span>
                      </div>
                      
                      {selectedWorker.phone && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone size={16} className="text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">Teléfono:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {selectedWorker.phone}
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar size={16} className="text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">Fecha de alta:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDate(selectedWorker.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Salary Information */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <DollarSign size={16} className="mr-2" />
                    Información Salarial
                  </h3>
                  <div className="space-y-3">
                    {selectedWorker.baseSalary ? (
                      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-300">Sueldo Base</p>
                        <p className="text-xl font-bold text-green-900 dark:text-green-100">
                          {formatCurrency(selectedWorker.baseSalary)}
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sueldo base no configurado
                        </p>
                      </div>
                    )}

                    {selectedWorker.hourlyRate && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">Tarifa por Hora</p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {formatCurrency(selectedWorker.hourlyRate)}/h
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contracts */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <Building2 size={16} className="mr-2" />
                    Contratos Asignados
                  </h3>
                  
                  {workerContracts.length === 0 ? (
                    <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Building2 size={24} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No hay contratos asignados
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workerContracts.map((contract) => (
                        <div
                          key={contract.id}
                          className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {contract.position}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              contract.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {contract.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <p>Departamento: {contract.department}</p>
                            <p>Tipo: {contract.contractType === 'full_time' ? 'Tiempo completo' : 
                                     contract.contractType === 'part_time' ? 'Tiempo parcial' : 'Freelance'}</p>
                            <p>Sueldo: {formatCurrency(contract.baseSalary)}</p>
                            <p>Inicio: {formatDate(contract.startDate)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Statistics */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FileText size={20} className="mr-2 text-purple-600 dark:text-purple-400" />
            Estadísticas Generales
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Users size={24} className="mx-auto text-blue-600 dark:text-blue-400 mb-2" />
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {workers.length}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Total Trabajadores
              </p>
            </div>

            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <User size={24} className="mx-auto text-green-600 dark:text-green-400 mb-2" />
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {mockWorkers.filter(w => w.role === 'admin').length}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Administradores
              </p>
            </div>

            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <User size={24} className="mx-auto text-yellow-600 dark:text-yellow-400 mb-2" />
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                {mockWorkers.filter(w => w.role === 'supervisor').length}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Supervisores
              </p>
            </div>

            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <User size={24} className="mx-auto text-purple-600 dark:text-purple-400 mb-2" />
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {mockWorkers.filter(w => w.role === 'tecnico').length}
              </p>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Técnicos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};