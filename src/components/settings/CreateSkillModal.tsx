import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface CreateSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateSkillModal: React.FC<CreateSkillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    value: '',
    label: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate input
      if (!formData.value.trim() || !formData.label.trim()) {
        throw new Error('Todos los campos son obligatorios');
      }

      // Convert value to lowercase and remove spaces
      const skillValue = formData.value.toLowerCase().replace(/\s+/g, '_');

      // Check if skill already exists
      const { data: existingSkills } = await supabase
        .rpc('get_skill_types');

      if (existingSkills?.some((skill: any) => skill.value === skillValue)) {
        throw new Error('Ya existe una especialidad con ese código');
      }

      // Add the new skill type to the enum
      const { error } = await supabase
        .rpc('add_skill_type', { 
          skill_type_value: skillValue,
          skill_type_label: formData.label.trim()
        });

      if (error) throw error;

      onSuccess?.();
      setFormData({ value: '', label: '' });
    } catch (error) {
      console.error('Error creating skill:', error);
      alert('Error al crear la especialidad: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white dark:bg-dark-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-600">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Nueva Especialidad
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6">
            <Input
              label="Código de la Especialidad"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              required
              fullWidth
              placeholder="Ej: carpinteria, soldadura, etc."
              pattern="[a-zA-Z0-9_]+"
              title="Solo se permiten letras, números y guiones bajos"
            />

            <Input
              label="Nombre de la Especialidad"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              required
              fullWidth
              placeholder="Ej: Carpintería, Soldadura, etc."
            />

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Nota:</strong> El código se convertirá automáticamente a minúsculas y los espacios se reemplazarán por guiones bajos.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                isLoading={isLoading}
                disabled={!formData.value.trim() || !formData.label.trim()}
                className="w-full sm:w-auto"
              >
                Crear Especialidad
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};