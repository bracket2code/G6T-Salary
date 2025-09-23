/*
  # Habilitar eliminación de especialidades

  1. Funciones
    - Crear función para eliminar especialidades de forma segura
    - Verificar que no estén en uso antes de eliminar
    - Manejar la recreación del tipo enum si es necesario

  2. Seguridad
    - Verificar permisos de usuario autenticado
    - Validar que la especialidad no esté siendo utilizada
*/

-- Function to safely delete a skill type
CREATE OR REPLACE FUNCTION delete_skill_type_safe(skill_type_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enum_values text[];
  new_enum_values text[];
  temp_type_name text;
BEGIN
  -- Check if the skill type is being used
  IF EXISTS (
    SELECT 1 FROM user_skills 
    WHERE skill_type::text = skill_type_value
  ) THEN
    RAISE EXCEPTION 'No se puede eliminar la especialidad "%" porque está siendo utilizada por usuarios', skill_type_value;
  END IF;
  
  -- Verify the skill type exists
  IF NOT EXISTS (
    SELECT 1 FROM unnest(enum_range(NULL::skill_type)) AS skill_type 
    WHERE skill_type::text = skill_type_value
  ) THEN
    RAISE EXCEPTION 'La especialidad "%" no existe', skill_type_value;
  END IF;
  
  -- Get current enum values
  SELECT array_agg(enumlabel ORDER BY enumsortorder)
  INTO enum_values
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'skill_type';
  
  -- Remove the value we want to delete
  SELECT array_agg(val)
  INTO new_enum_values
  FROM unnest(enum_values) AS val
  WHERE val != skill_type_value;
  
  -- Create a temporary enum type name
  temp_type_name := 'skill_type_temp_' || extract(epoch from now())::bigint;
  
  -- Create new enum type without the deleted value
  EXECUTE format('CREATE TYPE %I AS ENUM (%s)', 
    temp_type_name, 
    array_to_string(array(SELECT quote_literal(val) FROM unnest(new_enum_values) AS val), ', ')
  );
  
  -- Update the user_skills table to use the new type
  EXECUTE format('ALTER TABLE user_skills ALTER COLUMN skill_type TYPE %I USING skill_type::text::%I', 
    temp_type_name, temp_type_name);
  
  -- Drop the old enum type
  DROP TYPE skill_type;
  
  -- Rename the new type to the original name
  EXECUTE format('ALTER TYPE %I RENAME TO skill_type', temp_type_name);
  
  -- Recreate the get_skill_types function to ensure it works with the new enum
  DROP FUNCTION IF EXISTS get_skill_types();
  CREATE OR REPLACE FUNCTION get_skill_types()
  RETURNS TABLE (
    value text,
    label text
  )
  LANGUAGE plpgsql
  AS $func$
  BEGIN
    RETURN QUERY
    SELECT 
      enumlabel::text as value,
      enumlabel::text as label
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'skill_type'
    ORDER BY e.enumsortorder;
  END;
  $func$;
  
END;
$$;

-- Update the delete_skill_type function to use the safe version
CREATE OR REPLACE FUNCTION delete_skill_type(skill_type_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM delete_skill_type_safe(skill_type_value);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_skill_type_safe(text) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_skill_type(text) TO authenticated;