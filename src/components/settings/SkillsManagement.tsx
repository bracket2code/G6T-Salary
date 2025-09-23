import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Edit, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CreateSkillModal } from './CreateSkillModal';
import { EditSkillModal } from './EditSkillModal';
import { supabase } from '../../lib/supabase';

interface Skill {
  value: string;
  label: string;
}

export const SkillsManagement: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  const fetchSkills = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_skill_types');

      if (error) throw error;

      let filteredSkills = data;

      if (searchQuery) {
        filteredSkills = filteredSkills.filter((skill: any) =>
          skill.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.value.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setSkills(filteredSkills);
    } catch (error) {
      console.error('Error fetching skills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [searchQuery]);

  const handleDeleteSkill = async (skill: Skill) => {
    if (!confirm(`¿Está seguro de que desea eliminar la especialidad "${skill.label}"?\n\nEsta acción no se puede deshacer y solo es posible si ningún usuario tiene asignada esta especialidad.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .rpc('delete_skill_type', { skill_type_value: skill.value });

      if (error) throw error;

      fetchSkills();
    } catch (error) {
      console.error('Error deleting skill:', error);
      alert('Error al eliminar la especialidad: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestión de Especialidades
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Administra las especialidades disponibles en el sistema
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          leftIcon={<Plus size={18} />}
          className="w-full sm:w-auto"
        >
          Nueva Especialidad
        </Button>
      </div>

      {/* Search */}
      <div className="w-full max-w-md">
        <Input
          placeholder="Buscar especialidades..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search size={18} />}
          fullWidth
        />
      </div>

      {/* Skills List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : skills.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Wrench size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No se encontraron especialidades' : 'No hay especialidades registradas'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery 
                ? 'No hay especialidades que coincidan con tu búsqueda'
                : 'Comienza agregando especialidades al sistema'}
            </p>
            {!searchQuery && (
              <Button 
                leftIcon={<Plus size={18} />}
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto"
              >
                Agregar Especialidad
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {skills.map((skill) => (
            <Card key={skill.value} className="hover:shadow-lg transition-shadow duration-200 w-full max-w-full">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Wrench size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {skill.label}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Código: {skill.value}
                      </p>
                    </div>
                  </div>
                  <div className="flex space-x-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSkill(skill)}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteSkill(skill)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateSkillModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchSkills();
        }}
      />

      <EditSkillModal
        skill={editingSkill}
        isOpen={!!editingSkill}
        onClose={() => setEditingSkill(null)}
        onSuccess={() => {
          setEditingSkill(null);
          fetchSkills();
        }}
      />
    </div>
  );
};