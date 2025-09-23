import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Shield, Plus, Trash2, Edit, Building2 } from 'lucide-react';
import { Worker, WorkerSkill, Location } from '../../types';
import { Button } from '../ui/Button';
import { MultiSelect } from '../ui/MultiSelect';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';

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

const skillLevelDisplayNames: Record<string, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  experto: 'Experto'
};

interface UserDetailsModalProps {
  user: Worker | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [skillTypes, setSkillTypes] = useState<Array<{ value: string, label: string }>>([]);
  const [skillLevels, setSkillLevels] = useState<Array<{ value: string, label: string }>>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Array<{ skill: string, level: string }>>([]);
  const [selectedSkillsToRemove, setSelectedSkillsToRemove] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedLocationsToRemove, setSelectedLocationsToRemove] = useState<string[]>([]);
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'tecnico',
  });

  useEffect(() => {
    if (user) {
      setEditData({
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
      });
    }
  }, [user]);

  useEffect(() => {
    fetchSkillEnums();
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setLocations(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  const fetchSkillEnums = async () => {
    try {
      const { data: skillTypesData, error: skillTypesError } = await supabase
        .rpc('get_skill_types');
      
      if (skillTypesError) throw skillTypesError;
      
      // Map database values to display labels
      const mappedSkillTypes = skillTypesData.map((item: any) => ({
        value: item.value,
        label: skillDisplayNames[item.value] || item.label
      }));
      setSkillTypes(mappedSkillTypes);

      const { data: skillLevelsData, error: skillLevelsError } = await supabase
        .rpc('get_skill_levels');
      
      if (skillLevelsError) throw skillLevelsError;
      
      // Map database values to display labels
      const mappedSkillLevels = skillLevelsData.map((item: any) => ({
        value: item.value,
        label: skillLevelDisplayNames[item.value] || item.label
      }));
      setSkillLevels(mappedSkillLevels);
    } catch (error) {
      console.error('Error fetching skill enums:', error);
    }
  };

  const handleUpdateUser = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Actualizar en la tabla workers
      const { error } = await supabase
        .from('workers')
        .update({
          name: editData.name,
          email: editData.email.toLowerCase(),
          phone: editData.phone || null,
          role: editData.role,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Si el email cambió, también actualizar en auth
      if (editData.email.toLowerCase() !== user.email.toLowerCase()) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email: editData.email.toLowerCase() }
        );
        
        if (authError) {
          console.warn('No se pudo actualizar el email en auth:', authError);
        }
      }
      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error al actualizar el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSkills = async () => {
    if (!user || selectedSkills.length === 0) return;

    setIsLoading(true);
    try {
      // Insert skills one by one to handle potential conflicts
      for (const skillData of selectedSkills) {
        const { error } = await supabase
          .from('user_skills')
          .insert({
            user_id: user.id,
            skill_type: skillData.skill,
            skill_level: skillData.level,
          });
        
        if (error) {
          // If it's a duplicate key error, continue with next skill
          if (error.code === '23505') {
            console.warn(`Skill ${skillData.skill} already assigned to user`);
            continue;
          }
          throw error;
        }
      }

      setSelectedSkills([]);
      
      // Refrescar los datos del usuario para mostrar la nueva especialidad
      await refreshUserData();
    } catch (error) {
      console.error('Error adding skills:', error);
      alert('Error al agregar especialidades: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;

      // Refrescar los datos del usuario para mostrar los cambios
      await refreshUserData();
    } catch (error) {
      console.error('Error removing skill:', error);
      alert('Error al eliminar especialidad');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAllSkills = async () => {
    if (!user || !user.skills || user.skills.length === 0) return;

    if (!confirm(`¿Está seguro de que desea eliminar todas las especialidades (${user.skills.length}) de este usuario?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_skills')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshUserData();
    } catch (error) {
      console.error('Error removing all skills:', error);
      alert('Error al eliminar todas las especialidades');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMultipleSkills = async () => {
    if (!user || selectedSkillsToRemove.length === 0) return;

    if (!confirm(`¿Está seguro de que desea eliminar ${selectedSkillsToRemove.length} especialidad${selectedSkillsToRemove.length !== 1 ? 'es' : ''} de este usuario?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_skills')
        .delete()
        .in('id', selectedSkillsToRemove);

      if (error) throw error;

      setSelectedSkillsToRemove([]);
      await refreshUserData();
    } catch (error) {
      console.error('Error removing multiple skills:', error);
      alert('Error al eliminar las especialidades seleccionadas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLocations = async () => {
    if (!user || selectedLocations.length === 0) return;

    setIsLoading(true);
    try {
      // Insert locations one by one to handle potential conflicts
      for (const locationId of selectedLocations) {
        const { error } = await supabase
          .from('user_locations')
          .insert({
            user_id: user.id,
            location_id: locationId,
          });
        
        if (error) {
          // If it's a duplicate key error, continue with next location
          if (error.code === '23505') {
            console.warn(`Location ${locationId} already assigned to user`);
            continue;
          }
          throw error;
        }
      }

      setSelectedLocations([]);
      
      // Refrescar los datos del usuario para mostrar la nueva ubicación
      await refreshUserData();
    } catch (error) {
      console.error('Error adding locations:', error);
      alert('Error al agregar ubicaciones: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveLocation = async (locationId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      // Refrescar los datos del usuario para mostrar los cambios
      await refreshUserData();
    } catch (error) {
      console.error('Error removing location:', error);
      alert('Error al eliminar ubicación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAllLocations = async () => {
    if (!user || !user.locations || user.locations.length === 0) return;

    if (!confirm(`¿Está seguro de que desea desasignar todos los locales (${user.locations.length}) de este usuario?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_locations')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshUserData();
    } catch (error) {
      console.error('Error removing all locations:', error);
      alert('Error al desasignar todos los locales');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMultipleLocations = async () => {
    if (!user || selectedLocationsToRemove.length === 0) return;

    if (!confirm(`¿Está seguro de que desea desasignar ${selectedLocationsToRemove.length} local${selectedLocationsToRemove.length !== 1 ? 'es' : ''} de este usuario?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('user_locations')
        .delete()
        .in('id', selectedLocationsToRemove);

      if (error) throw error;

      setSelectedLocationsToRemove([]);
      await refreshUserData();
    } catch (error) {
      console.error('Error removing multiple locations:', error);
      alert('Error al desasignar los locales seleccionados');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .rpc('get_users_with_skills');

      if (error) throw error;

      const updatedUser = data.find((u: any) => u.user_id === user.id);
      if (updatedUser) {
        const formattedUser: Worker = {
          id: updatedUser.user_id,
          name: updatedUser.user_name,
          email: updatedUser.user_email,
          role: updatedUser.user_role,
          phone: updatedUser.user_phone,
          avatarUrl: updatedUser.user_avatar_url,
          createdAt: updatedUser.user_created_at,
          updatedAt: updatedUser.user_updated_at,
          skills: updatedUser.skills || [],
          locations: updatedUser.locations || [],
        };
        
        // Actualizar el usuario localmente para reflejar los cambios inmediatamente
        Object.assign(user, formattedUser);
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  if (!isOpen || !user) return null;

  const availableSkillTypes = skillTypes.filter(skillType => 
    !user.skills?.some(skill => skill.skill_type === skillType.value)
  );

  const handleSkillSelectionChange = (skillValues: string[]) => {
    const newSelectedSkills = skillValues.map(skillValue => ({
      skill: skillValue,
      level: 'principiante' // Default level
    }));
    setSelectedSkills(newSelectedSkills);
  };

  const handleSkillLevelChange = (skillValue: string, level: string) => {
    setSelectedSkills(prev => 
      prev.map(skill => 
        skill.skill === skillValue 
          ? { ...skill, level }
          : skill
      )
    );
  };

  const availableLocations = locations.filter(location => 
    !user.locations?.some(userLocation => userLocation.location_id === location.id)
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
      
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white dark:bg-dark-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-600">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Detalles del Usuario
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* User Info */}
            <div className="flex items-center space-x-4">
              <Avatar name={user.name} src={user.avatarUrl} size="lg" />
              <div className="flex-1">
                {!isEditing ? (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                    {user.phone && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {user.phone}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                      {user.role === 'admin' ? 'Administrador' :
                       user.role === 'supervisor' ? 'Supervisor' : 'Usuario'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Input
                      label="Nombre"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      fullWidth
                    />
                    <Input
                      type="email"
                      label="Correo electrónico"
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      fullWidth
                    />
                    <Input
                      type="tel"
                      label="Teléfono"
                      value={editData.phone}
                      onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                      fullWidth
                    />
                    <Select
                      label="Rol"
                      value={editData.role}
                      onChange={(value) => setEditData({ ...editData, role: value })}
                      options={[
                        { value: 'tecnico', label: 'Usuario' },
                        { value: 'supervisor', label: 'Supervisor' },
                        { value: 'admin', label: 'Administrador' },
                      ]}
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    leftIcon={<Edit size={16} />}
                  >
                    Editar
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleUpdateUser}
                      isLoading={isLoading}
                    >
                      Guardar
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Skills Section */}
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                Especialidades
              </h4>

              {/* Current Skills */}
              {user.skills && user.skills.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Especialidades actuales ({user.skills.length}):
                    </h5>
                    {user.skills.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRemoveAllSkills}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                        isLoading={isLoading}
                      >
                        Eliminar todas
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {user.skills.map((skill) => (
                      <div
                        key={skill.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {skill.skill_type ? skillDisplayNames[skill.skill_type] || skill.skill_type : 'Sin definir'}
                          </span>
                          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                            ({skill.skill_level ? skillLevelDisplayNames[skill.skill_level] || skill.skill_level : 'Sin definir'})
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveSkill(skill.id)}
                          isLoading={isLoading}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Eliminación múltiple */}
                  {user.skills.length > 1 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Eliminar múltiples especialidades:
                      </h5>
                      <div className="space-y-3">
                        <MultiSelect
                          value={selectedSkillsToRemove}
                          onChange={setSelectedSkillsToRemove}
                          options={user.skills.map(skill => ({
                            value: skill.id,
                            label: `${skillDisplayNames[skill.skill_type] || skill.skill_type} (${skillLevelDisplayNames[skill.skill_level] || skill.skill_level})`
                          }))}
                          placeholder="Seleccionar especialidades para eliminar"
                          className="w-full"
                          showSelectAll={true}
                        />
                        {selectedSkillsToRemove.length > 0 && (
                          <div className="flex justify-end">
                            <Button
                              onClick={handleRemoveMultipleSkills}
                              isLoading={isLoading}
                              variant="outline"
                              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                              size="sm"
                            >
                              Eliminar {selectedSkillsToRemove.length} especialidad{selectedSkillsToRemove.length !== 1 ? 'es' : ''}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No hay especialidades definidas
                  </p>
                </div>
              )}

              {/* Add New Skill */}
              {availableSkillTypes.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Agregar especialidades:
                  </h5>
                  <div className="space-y-4">
                    <MultiSelect
                      value={selectedSkills.map(s => s.skill)}
                      onChange={handleSkillSelectionChange}
                      options={availableSkillTypes}
                      placeholder="Seleccionar especialidades"
                      className="w-full"
                      showSelectAll={true}
                    />
                    
                    {/* Configurar niveles para cada especialidad seleccionada */}
                    {selectedSkills.length > 0 && (
                      <div className="space-y-3">
                        <h6 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Configurar niveles:
                        </h6>
                        {selectedSkills.map((skillData) => {
                          const skillInfo = skillTypes.find(st => st.value === skillData.skill);
                          return (
                            <div key={skillData.skill} className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">
                                {skillInfo?.label || skillData.skill}
                              </span>
                              <Select
                                value={skillData.level}
                                onChange={(level) => handleSkillLevelChange(skillData.skill, level)}
                                options={skillLevels}
                                className="w-32"
                              />
                            </div>
                          );
                        })}
                        
                        <div className="flex justify-end">
                          <Button
                            onClick={handleAddSkills}
                            isLoading={isLoading}
                            leftIcon={<Plus size={16} />}
                            size="sm"
                          >
                            Agregar {selectedSkills.length} especialidad{selectedSkills.length !== 1 ? 'es' : ''}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  {selectedSkills.length > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Se agregarán {selectedSkills.length} especialidad{selectedSkills.length !== 1 ? 'es' : ''} al usuario
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Locations Section */}
            <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
                <Building2 size={20} className="mr-2" />
                Locales Asignados
              </h4>

              {/* Current Locations */}
              {user.locations && user.locations.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Locales asignados actualmente ({user.locations.length}):
                    </h5>
                    {user.locations.length > 1 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRemoveAllLocations}
                        className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                        isLoading={isLoading}
                      >
                        Desasignar todos
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {user.locations.map((location) => (
                      <div
                        key={location.id}
                        className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg"
                      >
                        <div className="flex items-center">
                          <Building2 size={16} className="mr-2 text-blue-600 dark:text-blue-400" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {location.location_name}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLocation(location.id)}
                          isLoading={isLoading}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Desasignación múltiple */}
                  {user.locations.length > 1 && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                      <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Desasignar múltiples locales:
                      </h5>
                      <div className="space-y-3">
                        <MultiSelect
                          value={selectedLocationsToRemove}
                          onChange={setSelectedLocationsToRemove}
                          options={user.locations.map(location => ({
                            value: location.id,
                            label: location.location_name
                          }))}
                          placeholder="Seleccionar locales para desasignar"
                          className="w-full"
                          showSelectAll={true}
                        />
                        {selectedLocationsToRemove.length > 0 && (
                          <div className="flex justify-end">
                            <Button
                              onClick={handleRemoveMultipleLocations}
                              isLoading={isLoading}
                              variant="outline"
                              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                              size="sm"
                            >
                              Desasignar {selectedLocationsToRemove.length} local{selectedLocationsToRemove.length !== 1 ? 'es' : ''}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Building2 size={24} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No hay locales asignados
                  </p>
                </div>
              )}

              {/* Add New Location */}
              {availableLocations.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Asignar locales:
                  </h5>
                  <div className="space-y-3">
                    <MultiSelect
                      value={selectedLocations}
                      onChange={setSelectedLocations}
                      options={availableLocations.map(location => ({
                        value: location.id,
                        label: location.name
                      }))}
                      placeholder="Seleccionar locales"
                      className="w-full"
                      showSelectAll={true}
                    />
                    {selectedLocations.length > 0 && (
                      <div className="flex justify-end">
                        <Button
                          onClick={handleAddLocations}
                          isLoading={isLoading}
                          leftIcon={<Plus size={16} />}
                          size="sm"
                        >
                          Asignar {selectedLocations.length} local{selectedLocations.length !== 1 ? 'es' : ''}
                        </Button>
                      </div>
                    )}
                  </div>
                  {selectedLocations.length > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Se asignarán {selectedLocations.length} local{selectedLocations.length !== 1 ? 'es' : ''} al usuario
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};