/*
  # Función para analizar duplicados de locales

  1. Nueva función
    - `analyze_location_duplicates()` - Analiza y reporta locales duplicados
    - Identifica locales con el mismo nombre
    - Muestra información detallada sobre cada duplicado

  2. Utilidad
    - Ayuda a identificar problemas de sincronización
    - Proporciona información para limpieza de datos
    - Facilita el debugging de asignaciones de locales
*/

-- Función para analizar duplicados de locales
CREATE OR REPLACE FUNCTION analyze_location_duplicates()
RETURNS TABLE (
  location_name text,
  duplicate_count bigint,
  location_details jsonb
)
LANGUAGE sql
AS $$
  SELECT 
    l.name as location_name,
    COUNT(*) as duplicate_count,
    jsonb_agg(
      jsonb_build_object(
        'id', l.id,
        'name', l.name,
        'company_name', l.company_name,
        'notes', l.notes,
        'created_at', l.created_at,
        'user_assignments', (
          SELECT COUNT(*) 
          FROM user_locations ul 
          WHERE ul.location_id = l.id
        )
      )
      ORDER BY l.created_at
    ) as location_details
  FROM locations l
  GROUP BY l.name
  HAVING COUNT(*) > 1
  ORDER BY duplicate_count DESC, location_name;
$$;

-- Función para obtener estadísticas de locales
CREATE OR REPLACE FUNCTION get_location_stats()
RETURNS TABLE (
  stat_name text,
  stat_value bigint,
  details text
)
LANGUAGE sql
AS $$
  SELECT 'total_locations'::text, COUNT(*)::bigint, 'Total de locales en la base de datos'::text
  FROM locations
  
  UNION ALL
  
  SELECT 'duplicated_names'::text, COUNT(*)::bigint, 'Nombres de locales que están duplicados'::text
  FROM (
    SELECT name
    FROM locations
    GROUP BY name
    HAVING COUNT(*) > 1
  ) duplicates
  
  UNION ALL
  
  SELECT 'locations_with_assignments'::text, COUNT(DISTINCT location_id)::bigint, 'Locales que tienen usuarios asignados'::text
  FROM user_locations
  
  UNION ALL
  
  SELECT 'locations_with_tasks'::text, COUNT(DISTINCT location_id)::bigint, 'Locales que tienen tareas asignadas'::text
  FROM tasks
  WHERE location_id IS NOT NULL
  
  UNION ALL
  
  SELECT 'locations_from_api'::text, COUNT(*)::bigint, 'Locales sincronizados desde API externa'::text
  FROM locations
  WHERE notes LIKE '%API externa%' OR notes LIKE '%Organization:%'
  
  UNION ALL
  
  SELECT 'locations_manual'::text, COUNT(*)::bigint, 'Locales creados manualmente'::text
  FROM locations
  WHERE notes IS NULL OR (notes NOT LIKE '%API externa%' AND notes NOT LIKE '%Organization:%')
  
  ORDER BY stat_name;
$$;

-- Función para limpiar locales duplicados de forma segura
CREATE OR REPLACE FUNCTION cleanup_duplicate_locations()
RETURNS TABLE (
  action text,
  affected_rows bigint,
  details text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  duplicate_record RECORD;
  locations_to_keep uuid[];
  locations_to_delete uuid[];
  deleted_count bigint := 0;
  updated_assignments bigint := 0;
  updated_tasks bigint := 0;
BEGIN
  -- Para cada grupo de locales duplicados, mantener el más reciente
  FOR duplicate_record IN 
    SELECT name, array_agg(id ORDER BY created_at DESC) as location_ids
    FROM locations
    GROUP BY name
    HAVING COUNT(*) > 1
  LOOP
    -- Mantener el primer local (más reciente) y marcar el resto para eliminación
    locations_to_keep := locations_to_keep || duplicate_record.location_ids[1:1];
    locations_to_delete := locations_to_delete || duplicate_record.location_ids[2:];
    
    -- Actualizar asignaciones de usuarios para que apunten al local que se mantiene
    UPDATE user_locations 
    SET location_id = duplicate_record.location_ids[1]
    WHERE location_id = ANY(duplicate_record.location_ids[2:]);
    
    GET DIAGNOSTICS updated_assignments = ROW_COUNT;
    
    -- Actualizar tareas para que apunten al local que se mantiene
    UPDATE tasks 
    SET location_id = duplicate_record.location_ids[1]
    WHERE location_id = ANY(duplicate_record.location_ids[2:]);
    
    GET DIAGNOSTICS updated_tasks = ROW_COUNT;
  END LOOP;
  
  -- Eliminar locales duplicados
  IF array_length(locations_to_delete, 1) > 0 THEN
    DELETE FROM locations WHERE id = ANY(locations_to_delete);
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
  END IF;
  
  -- Retornar resultados
  RETURN QUERY VALUES 
    ('user_assignments_updated'::text, updated_assignments, 'Asignaciones de usuarios actualizadas'::text),
    ('tasks_updated'::text, updated_tasks, 'Tareas actualizadas'::text),
    ('locations_deleted'::text, deleted_count, 'Locales duplicados eliminados'::text);
END;
$$;

-- Otorgar permisos de ejecución
GRANT EXECUTE ON FUNCTION analyze_location_duplicates() TO authenticated;
GRANT EXECUTE ON FUNCTION get_location_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_duplicate_locations() TO authenticated;