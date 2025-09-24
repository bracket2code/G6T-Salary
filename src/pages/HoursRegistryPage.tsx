import React, { useState, useEffect } from 'react';
import { Clock, Search, Users, Plus, Save, Calendar, FileText } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { MultiSelect } from '../components/ui/MultiSelect';
import { Worker, HourEntry } from '../types/salary';
import { formatDate } from '../lib/utils';

interface HourEntryForm {
  workerId: string;
  workerName: string;
  date: string;
  regularHours: string;
  overtimeHours: string;
  description: string;
}

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

export const HoursRegistryPage: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [hourEntries, setHourEntries] = useState<HourEntryForm[]>([]);
  const [recentEntries, setRecentEntries] = useState<HourEntry[]>([]);

  useEffect(() => {
    fetchWorkers();
    fetchRecentEntries();
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [searchQuery]);

  useEffect(() => {
    // Update hour entries when workers are selected/deselected
    const newEntries = selectedWorkerIds.map(workerId => {
      const worker = workers.find(w => w.id === workerId);
      const existingEntry = hourEntries.find(e => e.workerId === workerId);
      
      return existingEntry || {
        workerId,
        workerName: worker?.name || 'Trabajador desconocido',
        date: selectedDate,
        regularHours: '8',
        overtimeHours: '0',
        description: ''
      };
    });
    
    setHourEntries(newEntries);
  }, [selectedWorkerIds, workers, selectedDate]);

  const fetchWorkers = async () => {
    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter workers based on search query
      let filteredWorkers = mockWorkers;
      if (searchQuery) {
        filteredWorkers = mockWorkers.filter(worker =>
          worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          worker.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      setWorkers(filteredWorkers);
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentEntries = async () => {
    try {
      // Mock recent entries
      const mockRecentEntries: HourEntry[] = [
        {
          id: '1',
          workerId: '1',
          workerName: 'Juan Pérez',
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
          regularHours: 8,
          overtimeHours: 2,
          description: 'Mantenimiento preventivo',
          approved: true,
          approvedBy: 'supervisor@example.com',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        },
        {
          id: '2',
          workerId: '2',
          workerName: 'María García',
          date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
          regularHours: 8,
          overtimeHours: 0,
          description: 'Reuniones de equipo',
          approved: false,
          createdAt: new Date(Date.now() - 172800000).toISOString()
        }
      ];
      
      setRecentEntries(mockRecentEntries);
    } catch (error) {
      console.error('Error fetching recent entries:', error);
    }
  };

  const updateHourEntry = (workerId: string, field: string, value: string) => {
    setHourEntries(prev => 
      prev.map(entry => 
        entry.workerId === workerId 
          ? { ...entry, [field]: value }
          : entry
      )
    );
  };

  const handleSaveAll = async () => {
    if (hourEntries.length === 0) {
      alert('No hay entradas de horas para guardar');
      return;
    }

    // Validate entries
    const invalidEntries = hourEntries.filter(entry => 
      !entry.regularHours || parseFloat(entry.regularHours) < 0
    );

    if (invalidEntries.length > 0) {
      alert('Por favor completa todas las horas regulares con valores válidos');
      return;
    }

    setIsSaving(true);
    try {
      // Simulate saving to local storage
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const savedEntries = hourEntries.map(entry => ({
        id: Math.random().toString(36).substr(2, 9),
        workerId: entry.workerId,
        workerName: entry.workerName,
        date: entry.date,
        regularHours: parseFloat(entry.regularHours),
        overtimeHours: parseFloat(entry.overtimeHours) || 0,
        description: entry.description,
        approved: false,
        createdAt: new Date().toISOString()
      }));

      // Add to recent entries
      setRecentEntries(prev => [...savedEntries, ...prev].slice(0, 10));
      
      alert('Horas registradas exitosamente');
      
      // Reset form
      setHourEntries([]);
      setSelectedWorkerIds([]);
    } catch (error) {
      console.error('Error saving hour entries:', error);
      alert('Error al guardar las horas');
    } finally {
      setIsSaving(false);
    }
  };

  const getTotalHours = () => {
    return hourEntries.reduce((totals, entry) => ({
      regular: totals.regular + (parseFloat(entry.regularHours) || 0),
      overtime: totals.overtime + (parseFloat(entry.overtimeHours) || 0)
    }), { regular: 0, overtime: 0 });
  };

  const totalHours = getTotalHours();

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Registro de Horas"
        description="Registra las horas trabajadas por uno o varios empleados"
        actionLabel="Guardar Todo"
        onAction={handleSaveAll}
        actionIcon={<Save size={18} />}
      />

      {/* Date and Worker Selection */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Calendar size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
            Selección de Fecha y Trabajadores
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="date"
              label="Fecha"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              fullWidth
            />

            <Input
              placeholder="Buscar trabajadores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search size={18} />}
              fullWidth
            />
          </div>

          <MultiSelect
            label="Trabajadores"
            value={selectedWorkerIds}
            onChange={setSelectedWorkerIds}
            options={workers.map(worker => ({
              value: worker.id,
              label: `${worker.name} - ${worker.email}`
            }))}
            placeholder="Seleccionar trabajadores"
            showSelectAll={true}
          />

          {selectedWorkerIds.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Registrando horas para <strong>{selectedWorkerIds.length}</strong> trabajador{selectedWorkerIds.length !== 1 ? 'es' : ''} 
                el día <strong>{formatDate(selectedDate)}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hour Entries */}
      {hourEntries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Registro de Horas ({hourEntries.length})
            </h2>
            
            {totalHours.regular > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total: {totalHours.regular}h regulares + {totalHours.overtime}h extra
              </div>
            )}
          </div>
          
          {hourEntries.map((entry, index) => (
            <Card key={entry.workerId}>
              <CardHeader>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {entry.workerName}
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    type="number"
                    label="Horas Regulares"
                    value={entry.regularHours}
                    onChange={(e) => updateHourEntry(entry.workerId, 'regularHours', e.target.value)}
                    placeholder="8"
                    min="0"
                    max="24"
                    step="0.5"
                    fullWidth
                  />
                  
                  <Input
                    type="number"
                    label="Horas Extra"
                    value={entry.overtimeHours}
                    onChange={(e) => updateHourEntry(entry.workerId, 'overtimeHours', e.target.value)}
                    placeholder="0"
                    min="0"
                    max="24"
                    step="0.5"
                    fullWidth
                  />
                  
                  <Input
                    label="Descripción"
                    value={entry.description}
                    onChange={(e) => updateHourEntry(entry.workerId, 'description', e.target.value)}
                    placeholder="Descripción del trabajo..."
                    fullWidth
                  />
                </div>

                {/* Quick hour buttons */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">Horas rápidas:</span>
                  {[4, 6, 8, 10, 12].map(hours => (
                    <Button
                      key={hours}
                      size="sm"
                      variant="outline"
                      onClick={() => updateHourEntry(entry.workerId, 'regularHours', hours.toString())}
                      className="text-xs"
                    >
                      {hours}h
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Clock size={20} className="mr-2 text-purple-600 dark:text-purple-400" />
            Entradas Recientes
          </h2>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No hay registros de horas recientes
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Los registros aparecerán aquí una vez que comiences a registrar horas
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {entry.workerName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(entry.date)} - {entry.regularHours}h + {entry.overtimeHours}h extra
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.approved 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {entry.approved ? 'Aprobado' : 'Pendiente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty State */}
      {hourEntries.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Selecciona trabajadores para registrar horas
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Elige una fecha y trabajadores para comenzar a registrar las horas trabajadas
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};