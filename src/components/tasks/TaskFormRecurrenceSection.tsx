import React from 'react';
import { Repeat, Calendar, Clock, Info } from 'lucide-react';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { TaskRecurrence } from '../../types';
import { formatInGMT2 } from '../../lib/timezone';

interface TaskFormRecurrenceSectionProps {
  isRecurring: boolean;
  onRecurringChange: (isRecurring: boolean) => void;
  recurrenceData: Partial<TaskRecurrence>;
  onRecurrenceChange: (data: Partial<TaskRecurrence>) => void;
  recurrenceTypes: Array<{ value: string, label: string }>;
  endDate: string;
  onEndDateChange: (date: string) => void;
}

const patternTypes = [
  { value: 'daily', label: 'Diario', description: 'Todos los días' },
  { value: 'weekly', label: 'Semanal', description: 'Días específicos de la semana' },
  { value: 'monthly', label: 'Mensual', description: 'Días específicos del mes' },
  { value: 'yearly', label: 'Anual', description: 'Fechas específicas del año' },
  { value: 'weekdays', label: 'Entre semana', description: 'Solo lunes a viernes' },
  { value: 'weekends', label: 'Fin de semana', description: 'Solo sábados y domingos' },
  { value: 'odd_days', label: 'Días impares', description: 'Solo días impares del mes (1, 3, 5...)' },
  { value: 'even_days', label: 'Días pares', description: 'Solo días pares del mes (2, 4, 6...)' },
  { value: 'custom_days', label: 'Días personalizados', description: 'Seleccionar días específicos del mes' },
  { value: 'nth_weekday', label: 'N-ésimo día de la semana', description: 'Ej: Primer lunes de cada mes' },
  { value: 'last_weekday', label: 'Último día de la semana', description: 'Ej: Último viernes del mes' },
  { value: 'business_days', label: 'Solo días laborables', description: 'Excluye fines de semana y festivos' },
];

const daysOfWeekOptions = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
];

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  value: (i + 1).toString(),
  label: formatInGMT2(Date.UTC(2024, i, 1), { month: 'long' }),
}));

const nthOptions = [
  { value: '1', label: 'Primer' },
  { value: '2', label: 'Segundo' },
  { value: '3', label: 'Tercer' },
  { value: '4', label: 'Cuarto' },
  { value: '-1', label: 'Último' },
];

export const TaskFormRecurrenceSection: React.FC<TaskFormRecurrenceSectionProps> = ({
  isRecurring,
  onRecurringChange,
  recurrenceData,
  onRecurrenceChange,
  recurrenceTypes,
  endDate,
  onEndDateChange,
}) => {
  const selectedPattern = patternTypes.find(p => p.value === recurrenceData.patternType);

  const handlePatternTypeChange = (type: string) => {
    onRecurrenceChange({
      ...recurrenceData,
      patternType: type as TaskRecurrence['patternType'],
      // Reset specific fields when changing type
      daysOfWeek: type === 'weekly' ? [] : undefined,
      customDays: type === 'custom_days' ? [] : undefined,
      dayOfMonth: ['monthly', 'custom_days'].includes(type) ? 1 : undefined,
      monthOfYear: type === 'yearly' ? 1 : undefined,
      nthOccurrence: type === 'nth_weekday' ? 1 : undefined,
      weekdayType: ['nth_weekday', 'last_weekday'].includes(type) ? 1 : undefined,
    });
  };

  const handleDaysOfWeekChange = (day: string, checked: boolean) => {
    const currentDays = recurrenceData.daysOfWeek || [];
    const dayValue = parseInt(day);
    
    if (checked) {
      onRecurrenceChange({
        ...recurrenceData,
        daysOfWeek: [...currentDays.filter(d => d !== dayValue), dayValue].sort()
      });
    } else {
      onRecurrenceChange({
        ...recurrenceData,
        daysOfWeek: currentDays.filter(d => d !== dayValue)
      });
    }
  };

  const handleCustomDaysChange = (day: string, checked: boolean) => {
    const currentDays = recurrenceData.customDays || [];
    const dayValue = parseInt(day);
    
    if (checked) {
      onRecurrenceChange({
        ...recurrenceData,
        customDays: [...currentDays.filter(d => d !== dayValue), dayValue].sort()
      });
    } else {
      onRecurrenceChange({
        ...recurrenceData,
        customDays: currentDays.filter(d => d !== dayValue)
      });
    }
  };

  const getRecurrenceSummary = () => {
    if (!recurrenceData.patternType) return '';

    const pattern = patternTypes.find(p => p.value === recurrenceData.patternType);
    let summary = pattern?.label || '';

    switch (recurrenceData.patternType) {
      case 'daily':
        summary += ` (cada ${recurrenceData.intervalValue || 1} día${(recurrenceData.intervalValue || 1) > 1 ? 's' : ''})`;
        break;
      case 'weekly':
        if (recurrenceData.daysOfWeek && recurrenceData.daysOfWeek.length > 0) {
          const dayNames = recurrenceData.daysOfWeek.map(d => 
            daysOfWeekOptions.find(opt => parseInt(opt.value) === d)?.label
          ).join(', ');
          summary += ` (${dayNames})`;
        }
        break;
      case 'monthly':
        summary += ` (día ${recurrenceData.dayOfMonth || 1})`;
        break;
      case 'yearly':
        const monthName = monthOptions.find(m => parseInt(m.value) === recurrenceData.monthOfYear)?.label;
        summary += ` (${monthName || 'enero'})`;
        break;
      case 'custom_days':
        if (recurrenceData.customDays && recurrenceData.customDays.length > 0) {
          summary += ` (días ${recurrenceData.customDays.join(', ')})`;
        }
        break;
      case 'nth_weekday':
        const nthLabel = nthOptions.find(n => parseInt(n.value) === recurrenceData.nthOccurrence)?.label;
        const weekdayLabel = daysOfWeekOptions.find(d => parseInt(d.value) === recurrenceData.weekdayType)?.label;
        summary += ` (${nthLabel} ${weekdayLabel} de cada mes)`;
        break;
    }

    return summary;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <Repeat size={20} className="text-blue-600 dark:text-blue-400" />
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
          Repetición de Tarea
        </h4>
      </div>

      {/* Toggle para activar repetición */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="isRecurring"
          checked={isRecurring}
          onChange={(e) => onRecurringChange(e.target.checked)}
          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
        />
        <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Crear tarea repetitiva
        </label>
      </div>

      {isRecurring && (
        <div className="space-y-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          {/* Tipo de patrón */}
          <div>
            <Select
              label="Patrón de repetición"
              value={recurrenceData.patternType || ''}
              onChange={handlePatternTypeChange}
              options={[
                { value: '', label: 'Seleccionar patrón' },
                ...patternTypes.map(p => ({ value: p.value, label: p.label }))
              ]}
            />
            {selectedPattern && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 flex items-center">
                <Info size={14} className="mr-1" />
                {selectedPattern.description}
              </p>
            )}
          </div>

          {/* Configuración específica por patrón */}
          {recurrenceData.patternType === 'daily' && (
            <Input
              type="number"
              label="Repetir cada X días"
              value={recurrenceData.intervalValue || 1}
              onChange={(e) => onRecurrenceChange({
                ...recurrenceData,
                intervalValue: parseInt(e.target.value) || 1
              })}
              min="1"
              max="365"
              fullWidth
            />
          )}

          {recurrenceData.patternType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Días de la semana
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {daysOfWeekOptions.map((day) => (
                  <label key={day.value} className="flex items-center space-x-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recurrenceData.daysOfWeek?.includes(parseInt(day.value)) || false}
                      onChange={(e) => handleDaysOfWeekChange(day.value, e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {day.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {recurrenceData.patternType === 'monthly' && (
            <Input
              type="number"
              label="Día del mes"
              value={recurrenceData.dayOfMonth || 1}
              onChange={(e) => onRecurrenceChange({
                ...recurrenceData,
                dayOfMonth: parseInt(e.target.value) || 1
              })}
              min="1"
              max="31"
              fullWidth
            />
          )}

          {recurrenceData.patternType === 'yearly' && (
            <Select
              label="Mes del año"
              value={recurrenceData.monthOfYear?.toString() || '1'}
              onChange={(value) => onRecurrenceChange({
                ...recurrenceData,
                monthOfYear: parseInt(value)
              })}
              options={monthOptions}
            />
          )}

          {recurrenceData.patternType === 'custom_days' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Días del mes (seleccionar múltiples)
              </label>
              <div className="grid grid-cols-7 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <label key={day} className="flex items-center justify-center p-2 border border-gray-200 dark:border-gray-600 rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="checkbox"
                      checked={recurrenceData.customDays?.includes(day) || false}
                      onChange={(e) => handleCustomDaysChange(day.toString(), e.target.checked)}
                      className="sr-only"
                    />
                    <span className={`text-sm font-medium ${
                      recurrenceData.customDays?.includes(day) 
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30' 
                        : 'text-gray-700 dark:text-gray-300'
                    } w-8 h-8 flex items-center justify-center rounded`}>
                      {day}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {recurrenceData.patternType === 'nth_weekday' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Ocurrencia"
                value={recurrenceData.nthOccurrence?.toString() || '1'}
                onChange={(value) => onRecurrenceChange({
                  ...recurrenceData,
                  nthOccurrence: parseInt(value)
                })}
                options={nthOptions}
              />
              <Select
                label="Día de la semana"
                value={recurrenceData.weekdayType?.toString() || '1'}
                onChange={(value) => onRecurrenceChange({
                  ...recurrenceData,
                  weekdayType: parseInt(value)
                })}
                options={daysOfWeekOptions}
              />
            </div>
          )}

          {recurrenceData.patternType === 'last_weekday' && (
            <Select
              label="Día de la semana"
              value={recurrenceData.weekdayType?.toString() || '1'}
              onChange={(value) => onRecurrenceChange({
                ...recurrenceData,
                weekdayType: parseInt(value)
              })}
              options={daysOfWeekOptions}
            />
          )}

          {/* Opciones adicionales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={recurrenceData.skipHolidays || false}
                  onChange={(e) => onRecurrenceChange({
                    ...recurrenceData,
                    skipHolidays: e.target.checked
                  })}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Saltar días festivos
                </span>
              </label>
            </div>

            <Input
              type="number"
              label="Máximo de instancias (opcional)"
              value={recurrenceData.maxInstances || ''}
              onChange={(e) => onRecurrenceChange({
                ...recurrenceData,
                maxInstances: e.target.value ? parseInt(e.target.value) : undefined
              })}
              min="1"
              max="1000"
              placeholder="Sin límite"
              fullWidth
            />
          </div>

          {/* Fecha de fin obligatoria */}
          <div className="pt-4 border-t border-blue-200 dark:border-blue-600">
            <Input
              type="date"
              label="Fecha de fin de repetición"
              value={endDate}
              onChange={(e) => {
                onEndDateChange(e.target.value);
              }}
              required={isRecurring}
              fullWidth
              error={isRecurring && !endDate ? 'La fecha de fin es obligatoria para tareas repetitivas' : undefined}
            />
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              <Clock size={12} className="inline mr-1" />
              La repetición se detendrá automáticamente en esta fecha (al final del día)
            </p>
          </div>

          {/* Resumen de configuración */}
          {recurrenceData.patternType && (
            <div className="p-4 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-600 rounded-lg">
              <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center">
                <Calendar size={16} className="mr-2" />
                Resumen de repetición:
              </h5>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {getRecurrenceSummary()}
              </p>
              {recurrenceData.maxInstances && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Máximo {recurrenceData.maxInstances} instancia{recurrenceData.maxInstances !== 1 ? 's' : ''}
                </p>
              )}
              {recurrenceData.skipHolidays && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Se saltarán los días festivos
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
