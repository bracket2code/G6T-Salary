import React from 'react';
import { Sparkles, Lightbulb, Plus } from 'lucide-react';
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

interface TaskFormSkillSuggestionsProps {
  suggestedSkills: string[];
  showSuggestions: boolean;
  onAddSuggestedSkill: (skill: string) => void;
  onAddAllSuggestions: () => void;
  onDismissSuggestions: () => void;
}

export const TaskFormSkillSuggestions: React.FC<TaskFormSkillSuggestionsProps> = ({
  suggestedSkills,
  showSuggestions,
  onAddSuggestedSkill,
  onAddAllSuggestions,
  onDismissSuggestions,
}) => {
  if (!showSuggestions || suggestedSkills.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
      <div className="flex items-center mb-3">
        <Sparkles size={20} className="text-blue-600 dark:text-blue-400 mr-2" />
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Especialidades Sugeridas por IA
        </h4>
      </div>
      <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
        Basado en la descripción, estas especialidades podrían ser relevantes:
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {suggestedSkills.map((skill) => (
          <button
            key={skill}
            type="button"
            onClick={() => onAddSuggestedSkill(skill)}
            className="inline-flex items-center px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 dark:bg-blue-800/50 dark:hover:bg-blue-700/50 dark:text-blue-200 rounded-full text-sm transition-colors duration-200 cursor-pointer"
          >
            <Plus size={12} className="mr-1" />
            {skillDisplayNames[skill] || skill}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onAddAllSuggestions}
          leftIcon={<Lightbulb size={14} />}
          className="text-xs"
        >
          Agregar todas
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onDismissSuggestions}
          className="text-xs"
        >
          Descartar
        </Button>
      </div>
    </div>
  );
};