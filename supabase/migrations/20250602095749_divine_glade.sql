/*
  # Corregir perfiles de trabajadores
  
  1. Cambios
    - Actualizar la tabla workers para manejar correctamente los perfiles de usuario
    - Agregar políticas RLS para permitir la creación y actualización de perfiles
    - Asegurar que el campo role tenga un valor por defecto
    
  2. Seguridad
    - Habilitar RLS en la tabla workers
    - Agregar políticas para gestión de perfiles
*/

-- Asegurar que la tabla workers tenga las columnas necesarias
ALTER TABLE workers
ALTER COLUMN role SET DEFAULT 'technician'::worker_role;

-- Actualizar las políticas RLS
DROP POLICY IF EXISTS "Allow users to insert worker profiles" ON workers;
CREATE POLICY "Allow users to insert worker profiles"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to update own profile" ON workers;
CREATE POLICY "Allow users to update own profile"
ON workers
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow authenticated users to view workers" ON workers;
CREATE POLICY "Allow authenticated users to view workers"
ON workers
FOR SELECT
TO authenticated
USING (true);

-- Asegurar que RLS está habilitado
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;