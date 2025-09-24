import React, { useState, useEffect } from 'react';
import { Calculator, Search, Users, Plus, Trash2, FileText } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { MultiSelect } from '../components/ui/MultiSelect';
import { Worker } from '../types/salary';

interface WorkerCalculation {
  workerId: string;
  workerName: string;
  baseSalary: string;
  hoursWorked: string;
  overtimeHours: string;
  bonuses: string;
  deductions: string;
  results?: {
    grossSalary: number;
    netSalary: number;
    taxes: number;
    socialSecurity: number;
  };
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

export const MultipleCalculatorPage: React.FC = () => {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [period, setPeriod] = useState('monthly');
  
  const [calculations, setCalculations] = useState<WorkerCalculation[]>([]);

  useEffect(() => {
    fetchWorkers();
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [searchQuery]);

  useEffect(() => {
    // Update calculations when workers are selected/deselected
    const newCalculations = selectedWorkerIds.map(workerId => {
      const worker = workers.find(w => w.id === workerId);
      const existingCalc = calculations.find(c => c.workerId === workerId);
      
      return existingCalc || {
        workerId,
        workerName: worker?.name || 'Trabajador desconocido',
        baseSalary: worker?.baseSalary?.toString() || '',
        hoursWorked: '',
        overtimeHours: '0',
        bonuses: '0',
        deductions: '0'
      };
    });
    
    setCalculations(newCalculations);
  }, [selectedWorkerIds, workers]);

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

  const updateCalculation = (workerId: string, field: string, value: string) => {
    setCalculations(prev => 
      prev.map(calc => 
        calc.workerId === workerId 
          ? { ...calc, [field]: value, results: undefined }
          : calc
      )
    );
  };

  const calculateSalaryForWorker = (calc: WorkerCalculation) => {
    const baseSalary = parseFloat(calc.baseSalary) || 0;
    const hoursWorked = parseFloat(calc.hoursWorked) || 0;
    const overtimeHours = parseFloat(calc.overtimeHours) || 0;
    const bonuses = parseFloat(calc.bonuses) || 0;
    const deductions = parseFloat(calc.deductions) || 0;

    const regularPay = baseSalary;
    const overtimePay = overtimeHours * (baseSalary / 160) * 1.5;
    const grossSalary = regularPay + overtimePay + bonuses;
    
    const taxRate = 0.21;
    const socialSecurityRate = 0.063;
    
    const taxes = grossSalary * taxRate;
    const socialSecurity = grossSalary * socialSecurityRate;
    const netSalary = grossSalary - taxes - socialSecurity - deductions;

    return {
      grossSalary,
      netSalary,
      taxes,
      socialSecurity
    };
  };

  const handleCalculateAll = () => {
    setIsCalculating(true);
    try {
      const updatedCalculations = calculations.map(calc => ({
        ...calc,
        results: calculateSalaryForWorker(calc)
      }));
      
      setCalculations(updatedCalculations);
    } catch (error) {
      console.error('Error calculating salaries:', error);
      alert('Error al calcular los sueldos');
    } finally {
      setIsCalculating(false);
    }
  };

  const removeWorker = (workerId: string) => {
    setSelectedWorkerIds(prev => prev.filter(id => id !== workerId));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getTotalResults = () => {
    const calculationsWithResults = calculations.filter(c => c.results);
    if (calculationsWithResults.length === 0) return null;

    return calculationsWithResults.reduce((totals, calc) => ({
      grossSalary: totals.grossSalary + calc.results!.grossSalary,
      netSalary: totals.netSalary + calc.results!.netSalary,
      taxes: totals.taxes + calc.results!.taxes,
      socialSecurity: totals.socialSecurity + calc.results!.socialSecurity
    }), { grossSalary: 0, netSalary: 0, taxes: 0, socialSecurity: 0 });
  };

  const totalResults = getTotalResults();

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      <PageHeader
        title="Cálculo Múltiple"
        description="Calcula sueldos de múltiples trabajadores simultáneamente"
        actionLabel="Calcular Todo"
        onAction={handleCalculateAll}
        actionIcon={<Calculator size={18} />}
      />

      {/* Worker Selection */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Users size={20} className="mr-2 text-blue-600 dark:text-blue-400" />
            Selección de Trabajadores
          </h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar trabajadores..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search size={18} />}
            fullWidth
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <Select
              label="Período de Cálculo"
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'monthly', label: 'Mensual' },
                { value: 'weekly', label: 'Semanal' },
                { value: 'daily', label: 'Diario' }
              ]}
              fullWidth
            />
          </div>

          {selectedWorkerIds.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{selectedWorkerIds.length}</strong> trabajador{selectedWorkerIds.length !== 1 ? 'es' : ''} seleccionado{selectedWorkerIds.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Individual Calculations */}
      {calculations.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Cálculos Individuales ({calculations.length})
          </h2>
          
          {calculations.map((calc, index) => (
            <Card key={calc.workerId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {calc.workerName}
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeWorker(calc.workerId)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Input
                    type="number"
                    label="Sueldo Base (€)"
                    value={calc.baseSalary}
                    onChange={(e) => updateCalculation(calc.workerId, 'baseSalary', e.target.value)}
                    placeholder="1500"
                    fullWidth
                  />
                  
                  <Input
                    type="number"
                    label="Horas Trabajadas"
                    value={calc.hoursWorked}
                    onChange={(e) => updateCalculation(calc.workerId, 'hoursWorked', e.target.value)}
                    placeholder="160"
                    fullWidth
                  />
                  
                  <Input
                    type="number"
                    label="Horas Extra"
                    value={calc.overtimeHours}
                    onChange={(e) => updateCalculation(calc.workerId, 'overtimeHours', e.target.value)}
                    placeholder="0"
                    fullWidth
                  />
                  
                  <Input
                    type="number"
                    label="Bonificaciones (€)"
                    value={calc.bonuses}
                    onChange={(e) => updateCalculation(calc.workerId, 'bonuses', e.target.value)}
                    placeholder="0"
                    fullWidth
                  />
                  
                  <Input
                    type="number"
                    label="Deducciones (€)"
                    value={calc.deductions}
                    onChange={(e) => updateCalculation(calc.workerId, 'deductions', e.target.value)}
                    placeholder="0"
                    fullWidth
                  />
                </div>

                {/* Results for this worker */}
                {calc.results && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-300">Bruto</p>
                        <p className="text-lg font-bold text-green-900 dark:text-green-100">
                          {formatCurrency(calc.results.grossSalary)}
                        </p>
                      </div>
                      
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">Neto</p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                          {formatCurrency(calc.results.netSalary)}
                        </p>
                      </div>
                      
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-700 dark:text-red-300">Impuestos</p>
                        <p className="text-lg font-bold text-red-900 dark:text-red-100">
                          {formatCurrency(calc.results.taxes)}
                        </p>
                      </div>
                      
                      <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <p className="text-sm text-orange-700 dark:text-orange-300">S. Social</p>
                        <p className="text-lg font-bold text-orange-900 dark:text-orange-100">
                          {formatCurrency(calc.results.socialSecurity)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Total Summary */}
      {totalResults && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <DollarSign size={20} className="mr-2 text-green-600 dark:text-green-400" />
              Resumen Total ({calculations.filter(c => c.results).length} trabajadores)
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
                <p className="text-sm text-green-700 dark:text-green-300 mb-1">Total Bruto</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(totalResults.grossSalary)}
                </p>
              </div>
              
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">Total Neto</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {formatCurrency(totalResults.netSalary)}
                </p>
              </div>
              
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
                <p className="text-sm text-red-700 dark:text-red-300 mb-1">Total Impuestos</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {formatCurrency(totalResults.taxes)}
                </p>
              </div>
              
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-1">Total S. Social</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {formatCurrency(totalResults.socialSecurity)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                variant="outline"
                leftIcon={<FileText size={16} />}
                onClick={() => {
                  alert('Función de exportar reporte próximamente');
                }}
              >
                Exportar Reporte
              </Button>
              
              <Button
                variant="outline"
                leftIcon={<Calculator size={16} />}
                onClick={() => {
                  alert('Función de guardar cálculos próximamente');
                }}
              >
                Guardar Todos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {calculations.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Selecciona trabajadores para comenzar
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Usa el selector de arriba para elegir múltiples trabajadores y calcular sus sueldos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};