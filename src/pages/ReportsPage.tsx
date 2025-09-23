import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardContent } from '../components/ui/Card';
import { BarChart2, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const ReportsPage: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Informes"
        description="Análisis y reportes de mantenimiento"
        actionLabel="Exportar"
        onAction={() => {}}
        actionIcon={<Download size={18} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tareas por Estado
              </h3>
              <BarChart2 className="text-blue-500" size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Próximamente: Gráfico de distribución de tareas por estado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tiempo Promedio
              </h3>
              <BarChart2 className="text-green-500" size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Próximamente: Tiempo promedio de resolución por tipo de tarea
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Carga de Trabajo
              </h3>
              <BarChart2 className="text-purple-500" size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Próximamente: Distribución de carga de trabajo por técnico
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};