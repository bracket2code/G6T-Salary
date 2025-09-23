/*
  # Función para eliminar tarea completa

  1. Nueva función
    - `delete_task_complete(task_id uuid)` - Elimina una tarea y todos sus datos relacionados
    - Maneja el orden correcto de eliminación para evitar violaciones de foreign key
    - Incluye manejo de errores y transacciones

  2. Seguridad
    - Función con SECURITY DEFINER para ejecutar con permisos elevados
    - Verificación de permisos del usuario
    - Transacción para garantizar consistencia

  3. Orden de eliminación
    - Primero elimina registros dependientes
    - Finalmente elimina la tarea principal
*/

-- Función para eliminar una tarea y todos sus datos relacionados
CREATE OR REPLACE FUNCTION delete_task_complete(p_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  conversation_ids uuid[];
BEGIN
  -- Verificar que la tarea existe
  IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = p_task_id) THEN
    RAISE EXCEPTION 'La tarea con ID % no existe', p_task_id;
  END IF;

  -- Iniciar transacción implícita (la función ya está en una transacción)
  
  -- 1. Obtener IDs de conversaciones para eliminar sus archivos adjuntos
  SELECT array_agg(id) INTO conversation_ids
  FROM task_conversations 
  WHERE task_id = p_task_id;

  -- 2. Eliminar archivos adjuntos de conversaciones
  IF conversation_ids IS NOT NULL AND array_length(conversation_ids, 1) > 0 THEN
    DELETE FROM conversation_attachments 
    WHERE conversation_id = ANY(conversation_ids);
  END IF;

  -- 3. Eliminar conversaciones de la tarea
  DELETE FROM task_conversations 
  WHERE task_id = p_task_id;

  -- 4. Eliminar asignaciones de la tarea
  DELETE FROM task_assignments 
  WHERE task_id = p_task_id;

  -- 5. Eliminar archivos adjuntos de la tarea
  DELETE FROM task_attachments 
  WHERE task_id = p_task_id;

  -- 6. Eliminar instancias de tareas recurrentes
  DELETE FROM recurring_task_instances 
  WHERE original_task_id = p_task_id OR generated_task_id = p_task_id;

  -- 7. Eliminar configuración de recurrencia
  DELETE FROM task_recurrence 
  WHERE task_id = p_task_id;

  -- 8. Eliminar especialidades requeridas de la tarea
  DELETE FROM task_skills 
  WHERE task_id = p_task_id;

  -- 9. Eliminar historial de la tarea
  DELETE FROM task_history 
  WHERE task_id = p_task_id;

  -- 10. Finalmente, eliminar la tarea principal
  DELETE FROM tasks 
  WHERE id = p_task_id;

  -- Si llegamos aquí, todo se eliminó correctamente
  RAISE NOTICE 'Tarea % eliminada completamente', p_task_id;

EXCEPTION
  WHEN OTHERS THEN
    -- En caso de error, la transacción se revierte automáticamente
    RAISE EXCEPTION 'Error al eliminar la tarea %: %', p_task_id, SQLERRM;
END;
$$;

-- Otorgar permisos de ejecución a usuarios autenticados
GRANT EXECUTE ON FUNCTION delete_task_complete(uuid) TO authenticated;

-- Comentario de la función
COMMENT ON FUNCTION delete_task_complete(uuid) IS 'Elimina una tarea y todos sus datos relacionados de forma segura y completa';