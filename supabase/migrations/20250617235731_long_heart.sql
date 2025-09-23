/*
  # Integración con Supabase Authentication

  1. Cambios
    - Actualizar políticas RLS para trabajar mejor con auth.uid()
    - Agregar función para sincronizar usuarios de auth con workers
    - Mejorar la gestión de perfiles de usuario

  2. Seguridad
    - Mantener RLS habilitado
    - Asegurar que los usuarios solo puedan acceder a sus propios datos
    - Permitir lectura de todos los workers para colaboración
*/

-- Función para manejar nuevos usuarios de auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.workers (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')::worker_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para crear perfil automáticamente cuando se registra un usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- Actualizar políticas RLS para workers
DROP POLICY IF EXISTS "Users can read all worker profiles" ON workers;
DROP POLICY IF EXISTS "Users can create own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can update own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can delete own worker profile" ON workers;

-- Nuevas políticas más claras
CREATE POLICY "Enable read access for authenticated users"
  ON workers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON workers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own worker profile"
  ON workers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own worker profile"
  ON workers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);