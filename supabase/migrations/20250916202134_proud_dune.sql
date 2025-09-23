/*
  # Limpiar conflictos de usuarios y arreglar trigger

  1. Limpieza de datos
    - Eliminar usuarios demo que causan conflictos
    - Limpiar workers huérfanos
    - Sincronizar usuarios auth con workers

  2. Arreglar trigger
    - Actualizar handle_new_user para manejar todos los conflictos
    - Usar upsert en lugar de insert
    - Manejo robusto de errores

  3. Verificación
    - Función para verificar integridad de datos
*/

-- 1. LIMPIAR DATOS CONFLICTIVOS
-- Eliminar usuarios demo que pueden estar causando problemas
DELETE FROM workers WHERE email IN ('admin@example.com', 'demo@example.com', 'test@example.com');
DELETE FROM workers WHERE id = '00000000-0000-0000-0000-000000000000';

-- Eliminar workers que no tienen usuarios auth correspondientes
DELETE FROM workers 
WHERE id NOT IN (
  SELECT id FROM auth.users
) AND email NOT LIKE '%@example.com';

-- 2. ARREGLAR TRIGGER HANDLE_NEW_USER
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_worker_id uuid;
  worker_name text;
  worker_role worker_role;
BEGIN
  -- Extraer información del usuario
  worker_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  worker_role := COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')::worker_role;
  
  -- Usar UPSERT para manejar conflictos automáticamente
  INSERT INTO public.workers (id, name, email, role, created_at)
  VALUES (
    NEW.id,
    worker_name,
    NEW.email,
    worker_role,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    updated_at = now()
  ON CONFLICT (email) DO UPDATE SET
    id = EXCLUDED.id,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    updated_at = now();
    
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar la creación del usuario auth
    RAISE WARNING 'Error en trigger handle_new_user: % - %', SQLSTATE, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RECREAR EL TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. SINCRONIZAR USUARIOS AUTH EXISTENTES CON WORKERS
DO $$
DECLARE
  auth_user record;
  worker_name text;
  worker_role worker_role;
BEGIN
  -- Para cada usuario auth, asegurar que tenga un perfil worker
  FOR auth_user IN 
    SELECT id, email, raw_user_meta_data, created_at
    FROM auth.users
  LOOP
    worker_name := COALESCE(auth_user.raw_user_meta_data->>'name', split_part(auth_user.email, '@', 1));
    worker_role := COALESCE(auth_user.raw_user_meta_data->>'role', 'tecnico')::worker_role;
    
    INSERT INTO workers (id, name, email, role, created_at)
    VALUES (
      auth_user.id,
      worker_name,
      auth_user.email,
      worker_role,
      auth_user.created_at
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now()
    ON CONFLICT (email) DO UPDATE SET
      id = EXCLUDED.id,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      updated_at = now();
  END LOOP;
  
  RAISE NOTICE 'Usuarios auth sincronizados con tabla workers';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error sincronizando usuarios: % - %', SQLSTATE, SQLERRM;
END $$;

-- 5. FUNCIÓN DE VERIFICACIÓN
CREATE OR REPLACE FUNCTION verify_user_integrity()
RETURNS TABLE (
  check_name text,
  status text,
  details text
) AS $$
BEGIN
  -- Verificar usuarios auth sin worker profile
  RETURN QUERY
  SELECT 
    'Auth users without worker profile'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::text,
    'Found ' || COUNT(*) || ' auth users without worker profile'::text
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM workers w WHERE w.id = au.id);
  
  -- Verificar workers sin usuario auth
  RETURN QUERY
  SELECT 
    'Workers without auth user'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END::text,
    'Found ' || COUNT(*) || ' workers without auth user'::text
  FROM workers w
  WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = w.id);
  
  -- Verificar duplicados por email
  RETURN QUERY
  SELECT 
    'Duplicate emails in workers'::text,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'ERROR' END::text,
    'Found ' || COUNT(*) || ' duplicate emails'::text
  FROM (
    SELECT email, COUNT(*) as cnt
    FROM workers
    GROUP BY email
    HAVING COUNT(*) > 1
  ) duplicates;
    
END;
$$ LANGUAGE plpgsql;

-- Ejecutar verificación
SELECT * FROM verify_user_integrity();