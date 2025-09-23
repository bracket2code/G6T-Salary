/*
  # Sistema de historial de cambios para tareas

  1. Nueva tabla `task_history`
    - `id` (uuid, primary key)
    - `task_id` (uuid, foreign key to tasks)
    - `user_id` (uuid, foreign key to workers)
    - `action_type` (enum: 'status_change', 'assignment', 'description_change', 'priority_change', 'attachment_added', 'attachment_removed', 'comment_added', 'created', 'updated')
    - `old_value` (text, valor anterior)
    - `new_value` (text, valor nuevo)
    - `description` (text, descripción del cambio)
    - `created_at` (timestamp)

  2. Seguridad
    - Habilitar RLS en `task_history`
    - Políticas para usuarios autenticados

  3. Triggers
    - Trigger para registrar cambios automáticamente en tasks
    - Trigger para registrar cambios en task_assignments
    - Trigger para registrar cambios en task_attachments
*/

-- Crear enum para tipos de acciones
CREATE TYPE task_action_type AS ENUM (
  'created',
  'status_change',
  'priority_change', 
  'description_change',
  'assignment_added',
  'assignment_removed',
  'attachment_added',
  'attachment_removed',
  'comment_added',
  'updated'
);

-- Crear tabla de historial de tareas
CREATE TABLE IF NOT EXISTS task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES workers(id),
  action_type task_action_type NOT NULL,
  old_value text,
  new_value text,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_created_at ON task_history(created_at);
CREATE INDEX IF NOT EXISTS idx_task_history_action_type ON task_history(action_type);

-- Habilitar RLS
ALTER TABLE task_history ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver historial"
  ON task_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar historial"
  ON task_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Función para registrar cambios en el historial
CREATE OR REPLACE FUNCTION log_task_change(
  p_task_id uuid,
  p_user_id uuid,
  p_action_type task_action_type,
  p_old_value text DEFAULT NULL,
  p_new_value text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO task_history (
    task_id,
    user_id,
    action_type,
    old_value,
    new_value,
    description
  ) VALUES (
    p_task_id,
    p_user_id,
    p_action_type,
    p_old_value,
    p_new_value,
    COALESCE(p_description, 
      CASE p_action_type
        WHEN 'created' THEN 'Tarea creada'
        WHEN 'status_change' THEN 'Estado cambiado de "' || COALESCE(p_old_value, 'N/A') || '" a "' || COALESCE(p_new_value, 'N/A') || '"'
        WHEN 'priority_change' THEN 'Prioridad cambiada de "' || COALESCE(p_old_value, 'N/A') || '" a "' || COALESCE(p_new_value, 'N/A') || '"'
        WHEN 'description_change' THEN 'Descripción actualizada'
        WHEN 'assignment_added' THEN 'Usuario asignado: ' || COALESCE(p_new_value, 'N/A')
        WHEN 'assignment_removed' THEN 'Usuario desasignado: ' || COALESCE(p_old_value, 'N/A')
        WHEN 'attachment_added' THEN 'Archivo adjunto agregado: ' || COALESCE(p_new_value, 'N/A')
        WHEN 'attachment_removed' THEN 'Archivo adjunto eliminado: ' || COALESCE(p_old_value, 'N/A')
        WHEN 'comment_added' THEN 'Comentario agregado'
        WHEN 'updated' THEN 'Tarea actualizada'
        ELSE 'Cambio realizado'
      END
    )
  );
END;
$$;

-- Trigger para registrar cambios en tasks
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
    -- Registrar creación de tarea
    PERFORM log_task_change(
      NEW.id,
      current_user_id,
      'created'::task_action_type,
      NULL,
      NULL,
      'Tarea creada'
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

-- Crear trigger para tasks
DROP TRIGGER IF EXISTS task_changes_trigger ON tasks;
CREATE TRIGGER task_changes_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_task_changes();

-- Trigger para registrar cambios en asignaciones
CREATE OR REPLACE FUNCTION trigger_log_assignment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  worker_name text;
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    -- Obtener nombre del trabajador asignado
    SELECT name INTO worker_name FROM workers WHERE id = NEW.worker_id;
    
    PERFORM log_task_change(
      NEW.task_id,
      current_user_id,
      'assignment_added'::task_action_type,
      NULL,
      worker_name
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Obtener nombre del trabajador desasignado
    SELECT name INTO worker_name FROM workers WHERE id = OLD.worker_id;
    
    PERFORM log_task_change(
      OLD.task_id,
      current_user_id,
      'assignment_removed'::task_action_type,
      worker_name,
      NULL
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Crear trigger para task_assignments
DROP TRIGGER IF EXISTS assignment_changes_trigger ON task_assignments;
CREATE TRIGGER assignment_changes_trigger
  AFTER INSERT OR DELETE ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_assignment_changes();

-- Trigger para registrar cambios en archivos adjuntos
CREATE OR REPLACE FUNCTION trigger_log_attachment_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    PERFORM log_task_change(
      NEW.task_id,
      current_user_id,
      'attachment_added'::task_action_type,
      NULL,
      NEW.file_name
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_task_change(
      OLD.task_id,
      current_user_id,
      'attachment_removed'::task_action_type,
      OLD.file_name,
      NULL
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Crear trigger para task_attachments
DROP TRIGGER IF EXISTS attachment_changes_trigger ON task_attachments;
CREATE TRIGGER attachment_changes_trigger
  AFTER INSERT OR DELETE ON task_attachments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_attachment_changes();

-- Trigger para registrar comentarios/conversaciones
CREATE OR REPLACE FUNCTION trigger_log_conversation_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_task_change(
      NEW.task_id,
      NEW.user_id,
      'comment_added'::task_action_type,
      NULL,
      LEFT(NEW.message, 50) || CASE WHEN LENGTH(NEW.message) > 50 THEN '...' ELSE '' END
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Crear trigger para task_conversations
DROP TRIGGER IF EXISTS conversation_changes_trigger ON task_conversations;
CREATE TRIGGER conversation_changes_trigger
  AFTER INSERT ON task_conversations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_conversation_changes();

-- Función para obtener historial de una tarea
CREATE OR REPLACE FUNCTION get_task_history(p_task_id uuid)
RETURNS TABLE (
  id uuid,
  action_type task_action_type,
  old_value text,
  new_value text,
  description text,
  created_at timestamptz,
  user_name text,
  user_role worker_role
)
LANGUAGE sql
AS $$
  SELECT 
    th.id,
    th.action_type,
    th.old_value,
    th.new_value,
    th.description,
    th.created_at,
    w.name as user_name,
    w.role as user_role
  FROM task_history th
  LEFT JOIN workers w ON th.user_id = w.id
  WHERE th.task_id = p_task_id
  ORDER BY th.created_at DESC;
$$;