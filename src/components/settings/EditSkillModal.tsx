import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface Skill {
  value: string;
  label: string;
}

interface EditSkillModalProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditSkillModal: React.FC<EditSkillModalProps> = ({
  skill,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    label: '',
  });

  useEffect(() => {
    if (skill) {
      setFormData({
        label: skill.label,
      });
    }
  }, [skill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skill) return;

    setIsLoading(true);

    try {
      if (!formData.label.trim()) {
        throw new Error('El nombre de la especialidad es obligatorio');
      }

      // Update the skill type label
      const { error } = await supabase
        .rpc('update_skill_type', {
          skill_type_value: skill.value,
          new_label: formData.label.trim()
        });

      if (error) throw error;

      onSuccess?.();
    } catch (error) {
      console.error('Error updating skill:', error);
      alert('Error al actualizar la especialidad: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !skill) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-600">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Editar Especialidad
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Código de la Especialidad
              </label>
              <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-500 dark:text-gray-400">
                {skill.value}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                El código no se puede modificar para mantener la integridad de los datos
              </p>
            </div>

            <Input
              label="Nombre de la Especialidad"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
              fullWidth
              placeholder="Ej: Carpintería, Soldadura, etc."
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={isLoading}
                disabled={!formData.label.trim()}
              >
                Actualizar Especialidad
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};