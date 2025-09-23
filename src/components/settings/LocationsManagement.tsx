import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit, Trash2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { CreateLocationModal } from './CreateLocationModal';
import { EditLocationModal } from './EditLocationModal';
import { supabase } from '../../lib/supabase';
import { Location } from '../../types';

export const LocationsManagement: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);

  const fetchLocations = async () => {
    setIsLoading(true);
    try {
      // Primero intentamos usar la función personalizada
      let { data, error } = await supabase
        .rpc('get_locations_with_details');

      // Si la función no existe, usar consulta directa
      if (error && error.message?.includes('function get_locations_with_details')) {
        const { data: directData, error: directError } = await supabase
          .from('locations')
          .select('*')
          .order('name');
          
        data = directData;
        error = directError;
      }

      if (error) {
        throw error;
      }
      
      // Aplicar filtro de búsqueda si existe
      let filteredData = data;
      if (searchQuery) {
        filteredData = data.filter((location: any) => 
          location.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      
      // Map database fields to TypeScript interface con valores por defecto
      const formattedLocations: Location[] = filteredData.map((location: any) => ({
        id: location.id,
        name: location.name,
        createdAt: location.created_at,
        cif: location.cif || '',
        companyName: location.company_name || '',
        address: location.address || '',
        city: location.city || '',
        postalCode: location.postal_code || '',
        province: location.province || '',
        contactPerson: location.contact_person || '',
        phone: location.phone || '',
        email: location.email || '',
        notes: location.notes || '',
      }));
      
      setLocations(formattedLocations);
    } catch (error) {
      // En caso de error, intentar una consulta básica
      try {
        const { data: basicData, error: basicError } = await supabase
          .from('locations')
          .select('id, name, created_at')
          .order('name');
          
        if (!basicError && basicData) {
          const basicLocations: Location[] = basicData.map((location: any) => ({
            id: location.id,
            name: location.name,
            createdAt: location.created_at,
            cif: '',
            companyName: '',
            address: '',
            city: '',
            postalCode: '',
            province: '',
            contactPerson: '',
            phone: '',
            email: '',
            notes: '',
          }));
          setLocations(basicLocations);
        }
      } catch (fallbackError) {
        // Silently fail - user will see empty state
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [searchQuery]);

  const handleDeleteLocation = async (location: Location) => {
    if (!confirm(`¿Está seguro de que desea eliminar el local "${location.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('locations')
        .delete()
        .eq('id', location.id);

      if (error) throw error;

      fetchLocations();
    } catch (error) {
      alert('Error al eliminar el local. Puede que tenga tareas asociadas.');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gestión de Locales
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Administra los locales y ubicaciones del sistema
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          leftIcon={<Plus size={18} />}
          className="w-full sm:w-auto"
        >
          Nuevo Local
        </Button>
      </div>

      {/* Search */}
      <div className="w-full max-w-md">
        <Input
          placeholder="Buscar locales..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search size={18} />}
          fullWidth
        />
      </div>

      {/* Locations List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : locations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No se encontraron locales' : 'No hay locales registrados'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery 
                ? 'No hay locales que coincidan con tu búsqueda'
                : 'Comienza agregando locales al sistema'}
            </p>
            {!searchQuery && (
              <Button 
                leftIcon={<Plus size={18} />}
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto"
              >
                Agregar Local
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {locations.map((location) => (
            <Card key={location.id} className="hover:shadow-lg transition-shadow duration-200 w-full max-w-full">
              <CardContent className="p-4">
                {/* Header con icono, título y botones */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                      <Building2 size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className={`min-w-0 flex-1 ${location.cif ? 'space-y-1' : 'flex items-center h-[52px]'}`}>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {location.name}
                      </h3>
                      {location.cif && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {location.cif}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingLocation(location)}
                      className="p-2"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteLocation(location)}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                
                {/* Nombre de la sociedad - Ocupa todo el ancho */}
                <div className="mt-3 min-h-[20px] flex items-center">
                  {location.companyName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed break-words w-full">
                      {location.companyName}
                    </p>
                  )}
                  {!location.companyName && location.city && location.province && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {location.city}, {location.province}
                    </p>
                  )}
                </div>
                
                {/* Información adicional - Visible en todas las pantallas */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400">
                    {location.contactPerson && (
                      <div className="truncate">
                        <span className="font-medium">Contacto:</span> {location.contactPerson}
                      </div>
                    )}
                    {location.phone && (
                      <div className="truncate">
                        <span className="font-medium">Tel:</span> {location.phone}
                      </div>
                    )}
                    {location.email && (
                      <div className="truncate">
                        <span className="font-medium">Email:</span> {location.email}
                      </div>
                    )}
                    {location.address && (
                      <div className="sm:col-span-2 lg:col-span-3 text-xs leading-relaxed">
                        <span className="font-medium">Dirección:</span> {location.address}
                        {location.postalCode && `, ${location.postalCode}`}
                        {location.city && ` ${location.city}`}
                        {location.province && `, ${location.province}`}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateLocationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchLocations();
        }}
      />

      <EditLocationModal
        location={editingLocation}
        isOpen={!!editingLocation}
        onClose={() => setEditingLocation(null)}
        onSuccess={() => {
          setEditingLocation(null);
          fetchLocations();
        }}
      />
    </div>
  );
};