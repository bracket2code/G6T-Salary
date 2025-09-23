import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface CreateLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateLocationModal: React.FC<CreateLocationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Primero intentamos usar la función de prueba
      const { data: testResult, error: testError } = await supabase
        .rpc('test_location_insert', {
          p_name: formData.name.trim(),
          p_cif: formData.cif.trim() || null,
          p_company_name: formData.companyName.trim() || null,
          p_address: formData.address.trim() || null,
          p_city: formData.city.trim() || null,
          p_postal_code: formData.postalCode.trim() || null,
          p_province: formData.province.trim() || null,
          p_contact_person: formData.contactPerson.trim() || null,
          p_phone: formData.phone.trim() || null,
          p_email: formData.email.trim() || null,
          p_notes: formData.notes.trim() || null,
        });

      if (testError) {
        throw testError;
      }

      if (testResult && !testResult.success) {
        throw new Error(`Database error: ${testResult.error} (${testResult.detail})`);
      }

      // Si la función de prueba no existe, usar inserción directa
      if (!testResult) {
        const insertData = {
          name: formData.name.trim(),
          cif: formData.cif.trim() || null,
          company_name: formData.companyName.trim() || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          postal_code: formData.postalCode.trim() || null,
          province: formData.province.trim() || null,
          contact_person: formData.contactPerson.trim() || null,
          phone: formData.phone.trim() || null,
          email: formData.email.trim() || null,
          notes: formData.notes.trim() || null,
        };

        const { data: directData, error: directError } = await supabase
          .from('locations')
          .insert([insertData])
          .select();

        if (directError) {
          throw directError;
        }
      }

      onSuccess?.();
      setFormData({
        name: formData.name.trim(),
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
      });
    } catch (error) {
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      alert('Error al crear el local: ' + errorMessage);
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
              Nuevo Local
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Información básica */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2">
                Información Básica
              </h3>
              
              <Input
                label="Nombre del Local"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                placeholder="Ej: Oficina Central, Almacén Norte..."
              />
            </div>

            {/* Datos fiscales */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2">
                Datos Fiscales
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="CIF"
                  value={formData.cif}
                  onChange={(e) => setFormData({ ...formData, cif: e.target.value })}
                  fullWidth
                  placeholder="A12345678"
                />
                
                <Input
                  label="Nombre de la Sociedad"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  fullWidth
                  placeholder="Empresa S.L."
                />
              </div>
            </div>

            {/* Dirección */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2">
                Dirección
              </h3>
              
              <Input
                label="Dirección"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                fullWidth
                placeholder="Calle, número, piso..."
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Ciudad"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  fullWidth
                  placeholder="Madrid"
                />
                
                <Input
                  label="Código Postal"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  fullWidth
                  placeholder="28001"
                />
                
                <Input
                  label="Provincia"
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                  fullWidth
                  placeholder="Madrid"
                />
              </div>
            </div>

            {/* Contacto */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2">
                Información de Contacto
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Persona de Contacto"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  fullWidth
                  placeholder="Juan Pérez"
                />
                
                <Input
                  type="tel"
                  label="Teléfono"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  fullWidth
                  placeholder="912 345 678"
                />
              </div>
              
              <Input
                type="email"
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                fullWidth
                placeholder="contacto@empresa.com"
              />
            </div>

            {/* Notas */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 pb-2">
                Notas Adicionales
              </h3>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-dark-700 dark:text-white resize-none"
                  placeholder="Información adicional sobre el local..."
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
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
                disabled={!formData.name.trim()}
                className="w-full sm:w-auto"
              >
                Crear Local
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};