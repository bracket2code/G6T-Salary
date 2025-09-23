import React from 'react';
import { Button } from '../ui/Button';
import { Task } from '../../types';

// Translation maps for display names
const skillDisplayNames: Record<string, string> = {
  electricidad: 'Electricidad',
  electronica: 'Electrónica',
  general: 'General',
  fontaneria: 'Fontanería',
  construccion: 'Construcción',
  tecnologia: 'Tecnología',
  cerrajeria: 'Cerrajería',
  cristaleria: 'Cristalería',
  limpieza: 'Limpieza',
  sonido: 'Sonido',
  luces: 'Luces'
};

interface TaskFormWorkersSectionProps {
  availableWorkers: any[];
  selectedWorkers: string[];
  requiredSkills: string[];
  formData: Partial<Task>;
  onWorkerSelection: (workerId: string) => void;
  onSelectAllWorkers: () => void;
  onDeselectAllWorkers: () => void;
}

export const TaskFormWorkersSection: React.FC<TaskFormWorkersSectionProps> = ({
  availableWorkers,
  selectedWorkers,
  requiredSkills,
  formData,
  onWorkerSelection,
  onSelectAllWorkers,
  onDeselectAllWorkers,
}) => {
  if (requiredSkills.length === 0 && !formData.locationId) {
    return null;
  }

  return (
    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
          Usuarios Sugeridos ({availableWorkers.length})
        </h4>
        {availableWorkers.length > 0 && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onSelectAllWorkers}
              disabled={selectedWorkers.length === availableWorkers.length}
            >
              Seleccionar todos
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDeselectAllWorkers}
              disabled={selectedWorkers.length === 0}
            >
              Deseleccionar todos
            </Button>
          </div>
        )}
      </div>
      
      {selectedWorkers.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>{selectedWorkers.length}</strong> usuario{selectedWorkers.length !== 1 ? 's' : ''} seleccionado{selectedWorkers.length !== 1 ? 's' : ''} para asignación automática
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Los usuarios seleccionados se asignarán automáticamente a la tarea una vez creada
          </p>
        </div>
      )}
      
      {requiredSkills.length > 0 && formData.locationId && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Mostrando usuarios que tienen las especialidades requeridas o están asignados al local seleccionado
        </p>
      )}
      
      {availableWorkers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
          {availableWorkers.map((worker) => (
            <div
              key={worker.user_id}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                selectedWorkers.includes(worker.user_id)
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600'
                  : 'bg-gray-50 dark:bg-gray-700 border-transparent hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => onWorkerSelection(worker.user_id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {worker.user_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {worker.user_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {worker.user_role === 'admin' ? 'Administrador' :
                       worker.user_role === 'supervisor' ? 'Supervisor' : 'Usuario'}
                    </p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selectedWorkers.includes(worker.user_id)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {selectedWorkers.includes(worker.user_id) && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="mt-2">
                {/* Skills matching */}
                {requiredSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {worker.skills
                      .filter((skill: any) => requiredSkills.includes(skill.skill_type))
                      .map((skill: any) => (
                        <span
                          key={skill.id}
                          className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 rounded-full text-xs"
                        >
                          {skillDisplayNames[skill.skill_type] || skill.skill_type}
                        </span>
                      ))}
                  </div>
                )}
                {/* Location matching */}
                {formData.locationId && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {worker.locations
                      .filter((location: any) => location.location_id === formData.locationId)
                      .map((location: any) => (
                        <span
                          key={location.id}
                          className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs"
                        >
                          📍 {location.location_name}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {requiredSkills.length > 0 && formData.locationId
              ? 'No hay usuarios con las especialidades requeridas o asignados al local seleccionado'
              : requiredSkills.length > 0
              ? 'No hay usuarios con las especialidades requeridas'
              : 'No hay usuarios asignados al local seleccionado'}
          </p>
        </div>
      )}
    </div>
  );
};