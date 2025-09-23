import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit, Trash2, Search, Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { supabase } from '../../lib/supabase';
import { getTaskStatuses, clearTaskStatusesCache, TaskStatus } from '../../lib/taskStatuses';

export const TaskStatusesManagement: React.FC = () => {
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStatus, setEditingStatus] = useState<TaskStatus | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    value: '',
    label: '',
    description: '',
    color: '#6b7280',
    order_index: 0,
  });

  const fetchStatuses = async () => {
    setIsLoading(true);
    try {
      const data = await getTaskStatuses();
      let filteredStatuses = data;

      if (searchQuery) {
        filteredStatuses = filteredStatuses.filter((status) =>
          status.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          status.value.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setStatuses(filteredStatuses);
    } catch (error) {
      console.error('Error fetching task statuses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, [searchQuery]);

  const handleCreateStatus = async () => {
    if (!formData.value.trim() || !formData.label.trim()) {
      alert('El valor y la etiqueta son obligatorios');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_statuses')
        .insert([{
          value: formData.value.toLowerCase().replace(/\s+/g, '_'),
          label: formData.label.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          order_index: formData.order_index || statuses.length + 1,
        }]);

      if (error) throw error;

      clearTaskStatusesCache();
      setShowCreateForm(false);
      setFormData({
        value: '',
        label: '',
        description: '',
        color: '#6b7280',
        order_index: 0,
      });
      fetchStatuses();
    } catch (error) {
      console.error('Error creating status:', error);
      alert('Error al crear el estado: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: TaskStatus) => {
    if (!editingStatus) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_statuses')
        .update({
          label: editingStatus.label,
          description: editingStatus.description || null,
          color: editingStatus.color,
          order_index: editingStatus.order_index,
        })
        .eq('value', status.value);

      if (error) throw error;

      clearTaskStatusesCache();
      setEditingStatus(null);
      fetchStatuses();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStatus = async (status: TaskStatus) => {
    if (!confirm(`¿Está seguro de que desea eliminar el estado "${status.label}"?\n\nEsta acción no se puede deshacer y solo es posible si ninguna tarea usa este estado.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('task_statuses')
        .update({ is_active: false })
        .eq('value', status.value);

      if (error) throw error;

      clearTaskStatusesCache();
      fetchStatuses();
    } catch (error) {
      console.error('Error deleting status:', error);
      alert('Error al eliminar el estado: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestión de Estados de Tareas
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Administra los estados disponibles para las tareas
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          leftIcon={<Plus size={18} />}
          className="w-full sm:w-auto"
        >
          Nuevo Estado
        </Button>
      </div>

      {/* Search */}
      <div className="w-full max-w-md">
        <Input
          placeholder="Buscar estados..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search size={18} />}
          fullWidth
        />
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Crear Nuevo Estado
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowCreateForm(false)}
              >
                <X size={16} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Valor (código)"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                placeholder="ej: en_revision"
                fullWidth
              />
              <Input
                label="Etiqueta"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="ej: En Revisión"
                fullWidth
              />
            </div>
            <Input
              label="Descripción"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descripción del estado"
              fullWidth
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                />
              </div>
              <Input
                type="number"
                label="Orden"
                value={formData.order_index}
                onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                placeholder="0"
                fullWidth
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateStatus}
                isLoading={isLoading}
                leftIcon={<Save size={16} />}
              >
                Crear Estado
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statuses List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : statuses.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Settings size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No se encontraron estados' : 'No hay estados registrados'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery 
                ? 'No hay estados que coincidan con tu búsqueda'
                : 'Comienza agregando estados al sistema'}
            </p>
            {!searchQuery && (
              <Button 
                leftIcon={<Plus size={18} />}
                onClick={() => setShowCreateForm(true)}
                className="w-full sm:w-auto"
              >
                Agregar Estado
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statuses.map((status) => (
            <Card key={status.value} className="hover:shadow-lg transition-shadow duration-200 w-full max-w-full">
              <CardContent className="p-4">
                {editingStatus?.value === status.value ? (
                  <div className="space-y-4">
                    <Input
                      label="Etiqueta"
                      value={editingStatus.label}
                      onChange={(e) => setEditingStatus({ ...editingStatus, label: e.target.value })}
                      fullWidth
                    />
                    <Input
                      label="Descripción"
                      value={editingStatus.description || ''}
                      onChange={(e) => setEditingStatus({ ...editingStatus, description: e.target.value })}
                      fullWidth
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Color
                        </label>
                        <input
                          type="color"
                          value={editingStatus.color || '#6b7280'}
                          onChange={(e) => setEditingStatus({ ...editingStatus, color: e.target.value })}
                          className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-md"
                        />
                      </div>
                      <Input
                        type="number"
                        label="Orden"
                        value={editingStatus.order_index}
                        onChange={(e) => setEditingStatus({ ...editingStatus, order_index: parseInt(e.target.value) || 0 })}
                        fullWidth
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(status)}
                        isLoading={isLoading}
                        leftIcon={<Save size={14} />}
                        className="flex-1"
                      >
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingStatus(null)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: status.color || '#6b7280' }}
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            {status.label}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Código: {status.value}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingStatus(status)}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteStatus(status)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                    
                    {status.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {status.description}
                      </p>
                    )}
                    
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Orden: {status.order_index}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};