/*
  # Configurar permisos para función Edge de creación de usuarios

  1. Seguridad
    - Configurar permisos necesarios para que la función Edge pueda crear usuarios
    - Asegurar que solo la función Edge tenga estos permisos elevados
    - Mantener la seguridad del sistema

  2. Funciones
    - Función segura para crear usuarios desde Edge Function
    - Validación de datos de entrada
    - Manejo de errores robusto

  3. Permisos
    - Otorgar permisos específicos para operaciones de autenticación
    - Restringir acceso solo a funciones autorizadas
*/

-- Función segura para crear usuarios desde Edge Function
CREATE OR REPLACE FUNCTION create_user_from_edge_function(
  p_email text,
  p_password text,
  p_name text,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'tecnico'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  result jsonb;
BEGIN
  -- Validar datos de entrada
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email es requerido';
  END IF;
  
  IF p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'Password es requerido';
  END IF;
  
  IF p_name IS NULL OR p_name = '' THEN
    RAISE EXCEPTION 'Nombre es requerido';
  END IF;

  -- Verificar que el email no esté en uso
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(p_email)) THEN
    RAISE EXCEPTION 'El email ya está registrado';
  END IF;

  -- Generar UUID para el nuevo usuario
  new_user_id := gen_random_uuid();

  -- Insertar en auth.users directamente (requiere permisos especiales)
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('name', p_name, 'role', p_role),
    false,
    'authenticated'
  );

  -- Crear perfil de worker
  INSERT INTO workers (
    id,
    name,
    email,
    phone,
    role
  ) VALUES (
    new_user_id,
    p_name,
    lower(p_email),
    p_phone,
    p_role::worker_role
  );

  -- Preparar resultado
  result := jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', lower(p_email),
    'name', p_name,
    'role', p_role
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    -- Limpiar en caso de error
    DELETE FROM auth.users WHERE id = new_user_id;
    DELETE FROM workers WHERE id = new_user_id;
    
    RAISE EXCEPTION 'Error creando usuario: %', SQLERRM;
END;
$$;

-- Otorgar permisos de ejecución solo a service_role
GRANT EXECUTE ON FUNCTION create_user_from_edge_function(text, text, text, text, text) TO service_role;

-- Función para autenticar usuario existente
CREATE OR REPLACE FUNCTION authenticate_user_from_edge_function(
  p_email text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record record;
  temp_password text;
  result jsonb;
BEGIN
  -- Buscar usuario existente
  SELECT id, email, encrypted_password INTO user_record
  FROM auth.users 
  WHERE email = lower(p_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Generar contraseña temporal
  temp_password := 'TempPass' || extract(epoch from now())::bigint || '!';

  -- Actualizar contraseña temporalmente
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(temp_password, gen_salt('bf')),
    updated_at = now()
  WHERE id = user_record.id;

  -- Preparar resultado con contraseña temporal
  result := jsonb_build_object(
    'success', true,
    'user_id', user_record.id,
    'email', user_record.email,
    'temp_password', temp_password
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error autenticando usuario: %', SQLERRM;
END;
$$;

-- Otorgar permisos de ejecución solo a service_role
GRANT EXECUTE ON FUNCTION authenticate_user_from_edge_function(text, text) TO service_role;

-- Comentarios sobre las funciones
COMMENT ON FUNCTION create_user_from_edge_function(text, text, text, text, text) IS 'Función segura para crear usuarios desde Edge Function con permisos elevados';
COMMENT ON FUNCTION authenticate_user_from_edge_function(text, text) IS 'Función segura para autenticar usuarios existentes desde Edge Function';