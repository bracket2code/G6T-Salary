import React from "react";
import { PageHeader } from "../components/layout/PageHeader";
import { Card, CardContent } from "../components/ui/Card";
import { Download, DollarSign, Users, Clock } from "lucide-react";

export const ReportsPage: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="Informes"
        description="Análisis y reportes de sueldos y horas"
        actionLabel="Exportar"
        onAction={() => {}}
        actionIcon={<Download size={18} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sueldos por Departamento
              </h3>
              <DollarSign className="text-blue-500" size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Próximamente: Gráfico de distribución de sueldos por departamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Horas Trabajadas
              </h3>
              <Clock className="text-green-500" size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Próximamente: Análisis de horas trabajadas por período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Análisis Salarial
              </h3>
              <Users className="text-purple-500" size={24} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Próximamente: Análisis comparativo de sueldos por trabajador
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
