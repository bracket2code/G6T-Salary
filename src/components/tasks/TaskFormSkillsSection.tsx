import React from 'react';
import { X, Plus } from 'lucide-react';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

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

interface TaskFormSkillsSectionProps {
  requiredSkills: string[];
  availableSkillTypes: Array<{ value: string, label: string }>;
  newSkill: string;
  onNewSkillChange: (value: string) => void;
  onAddSkill: () => void;
  onRemoveSkill: (skill: string) => void;
}

export const TaskFormSkillsSection: React.FC<TaskFormSkillsSectionProps> = ({
  requiredSkills,
  availableSkillTypes,
  newSkill,
  onNewSkillChange,
  onAddSkill,
  onRemoveSkill,
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
        Especialidades Requeridas
      </h4>
      
      {/* Current Required Skills */}
      {requiredSkills.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Especialidades seleccionadas:
          </h5>
          <div className="flex flex-wrap gap-2">
            {requiredSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm"
              >
                {skillDisplayNames[skill] || skill}
                <button
                  type="button"
                  onClick={() => onRemoveSkill(skill)}
                  className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add New Skill */}
      {availableSkillTypes.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Agregar especialidad:
          </h5>
          <div className="flex space-x-2">
            <Select
              value={newSkill}
              onChange={onNewSkillChange}
              options={[
                { value: '', label: 'Seleccionar especialidad' },
                ...availableSkillTypes
              ]}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={onAddSkill}
              disabled={!newSkill}
              leftIcon={<Plus size={16} />}
            >
              Agregar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};