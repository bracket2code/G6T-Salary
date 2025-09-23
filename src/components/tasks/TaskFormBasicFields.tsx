import React from 'react';
import { Input } from '../ui/Input';
import { TextArea } from '../ui/TextArea';
import { Select } from '../ui/Select';
import { Task, Location } from '../../types';

interface TaskFormBasicFieldsProps {
  formData: Partial<Task>;
  locations: Location[];
  statuses: Array<{ value: string, label: string }>;
  priorities: Array<{ value: string, label: string }>;
  mode: 'create' | 'edit';
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSelectChange: (name: string) => (value: string) => void;
}

export const TaskFormBasicFields: React.FC<TaskFormBasicFieldsProps> = ({
  formData,
  locations,
  statuses,
  priorities,
  mode,
  onChange,
  onSelectChange,
}) => {
  return (
    <>
      <Input
        label="Título"
        name="title"
        value={formData.title || ''}
        onChange={onChange}
        error={!formData.title ? 'El título es obligatorio' : undefined}
        required
        fullWidth
      />

      <TextArea
        label="Descripción"
        name="description"
        value={formData.description || ''}
        onChange={onChange}
        fullWidth
        placeholder="Describe el problema o tarea a realizar."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mode === 'edit' && (
          <Select
            label="Estado"
            name="status"
            value={formData.status || 'pendiente'}
            onChange={onSelectChange('status')}
            options={statuses}
          />
        )}

        <Select
          label="Prioridad"
          name="priority"
          value={formData.priority || ''}
          onChange={onSelectChange('priority')}
          options={priorities}
        />

        <Select
          label="Local"
          name="locationId"
          value={formData.locationId || ''}
          onChange={onSelectChange('locationId')}
          required
          options={[
            { value: '', label: 'Seleccionar local' },
            ...locations.map(loc => ({
              value: loc.id,
              label: loc.name
            }))
          ]}
        />

        <Input
          type="date"
          label="Fecha de inicio"
          name="startDate"
          value={formData.startDate || ''}
          onChange={onChange}
          error={!formData.startDate ? 'La fecha de inicio es obligatoria' : undefined}
          required
          fullWidth
        />

        <Input
          type="date"
          label="Fecha de fin"
          name="endDate"
          value={formData.endDate || ''}
          onChange={onChange}
          error={!formData.endDate ? 'La fecha de fin es obligatoria' : undefined}
          min={formData.startDate || undefined}
          required
          fullWidth
        />
      </div>
    </>
  );
};
