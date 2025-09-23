/*
  # Add task creation event to task history

  1. Changes
    - Update the trigger function to properly log task creation events
    - Ensure creation events are logged with the correct timestamp
    - Add better handling for task creation in the history system

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions needed
*/

-- Update the trigger function to better handle task creation events
CREATE OR REPLACE FUNCTION trigger_log_task_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Obtener el ID del usuario actual
  current_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    -- Registrar creación de tarea con la fecha de creación real
    INSERT INTO task_history (
      task_id,
      user_id,
      action_type,
      old_value,
      new_value,
      description,
      created_at
    ) VALUES (
      NEW.id,
      current_user_id,
      'created'::task_action_type,
      NULL,
      NEW.title,
      'Tarea creada: "' || NEW.title || '"',
      NEW.created_at -- Usar la fecha de creación real de la tarea
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Registrar cambio de estado
    IF OLD.status != NEW.status THEN
      PERFORM log_task_change(
        NEW.id,
        current_user_id,
        'status_change'::task_action_type,
        OLD.status::text,
        NEW.status::text
      );
    END IF;
    
    -- Registrar cambio de prioridad
    IF OLD.priority != NEW.priority THEN
      PERFORM log_task_change(
        NEW.id,
        current_user_id,
        'priority_change'::task_action_type,
        OLD.priority::text,
        NEW.priority::text
      );
    END IF;
    
    -- Registrar cambio de descripción
    IF COALESCE(OLD.description, '') != COALESCE(NEW.description, '') THEN
      PERFORM log_task_change(
        NEW.id,
        current_user_id,
        'description_change'::task_action_type,
        OLD.description,
        NEW.description
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Recrear el trigger para asegurar que use la función actualizada
DROP TRIGGER IF EXISTS task_changes_trigger ON tasks;
CREATE TRIGGER task_changes_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_task_changes();

-- Función para agregar eventos de creación a tareas existentes que no los tengan
CREATE OR REPLACE FUNCTION add_missing_creation_events()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  task_record RECORD;
BEGIN
  -- Buscar tareas que no tienen evento de creación en el historial
  FOR task_record IN 
    SELECT t.id, t.title, t.created_at
    FROM tasks t
    WHERE NOT EXISTS (
      SELECT 1 FROM task_history th 
      WHERE th.task_id = t.id 
      AND th.action_type = 'created'
    )
  LOOP
    -- Insertar evento de creación para cada tarea que no lo tenga
    INSERT INTO task_history (
      task_id,
      user_id,
      action_type,
      old_value,
      new_value,
      description,
      created_at
    ) VALUES (
      task_record.id,
      NULL, -- No sabemos quién creó las tareas existentes
      'created'::task_action_type,
      NULL,
      task_record.title,
      'Tarea creada: "' || task_record.title || '"',
      task_record.created_at
    );
  END LOOP;
  
  RAISE NOTICE 'Eventos de creación agregados para tareas existentes';
END;
$$;

-- Ejecutar la función para agregar eventos de creación a tareas existentes
SELECT add_missing_creation_events();

-- Eliminar la función temporal ya que no la necesitamos más
DROP FUNCTION add_missing_creation_events();