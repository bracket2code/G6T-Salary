/*
  # Sistema de Notificaciones Personalizadas

  1. Nueva Tabla
    - `user_notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to workers)
      - `title` (text, título de la notificación)
      - `message` (text, contenido del mensaje)
      - `type` (enum, tipo de notificación)
      - `is_read` (boolean, estado de lectura)
      - `related_task_id` (uuid, tarea relacionada opcional)
      - `metadata` (jsonb, datos adicionales)
      - `created_at` (timestamp)
      - `read_at` (timestamp, cuando se marcó como leída)

  2. Enum Types
    - `notification_type` (task_assigned, task_updated, task_completed, task_overdue, system_alert, reminder)

  3. Security
    - Enable RLS on `user_notifications` table
    - Add policies for users to only see their own notifications

  4. Functions
    - Function to create notifications
    - Function to mark notifications as read
    - Function to get user notifications with filters
*/

-- Create notification type enum
CREATE TYPE notification_type AS ENUM (
  'task_assigned',
  'task_updated', 
  'task_completed',
  'task_overdue',
  'system_alert',
  'reminder',
  'task_created',
  'assignment_removed'
);

-- Create user_notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL DEFAULT 'system_alert',
  is_read boolean NOT NULL DEFAULT false,
  related_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  read_at timestamptz DEFAULT NULL
);

-- Enable RLS
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can only see their own notifications"
  ON user_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON user_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON user_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications(type);
CREATE INDEX IF NOT EXISTS idx_user_notifications_related_task ON user_notifications(related_task_id);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type notification_type DEFAULT 'system_alert',
  p_related_task_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO user_notifications (
    user_id,
    title,
    message,
    type,
    related_task_id,
    metadata
  ) VALUES (
    p_user_id,
    p_title,
    p_message,
    p_type,
    p_related_task_id,
    p_metadata
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_notifications 
  SET 
    is_read = true,
    read_at = now()
  WHERE 
    id = p_notification_id 
    AND user_id = p_user_id;
    
  RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE user_notifications 
  SET 
    is_read = true,
    read_at = now()
  WHERE 
    user_id = p_user_id 
    AND is_read = false;
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Function to get user notifications with filters
CREATE OR REPLACE FUNCTION get_user_notifications(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_is_read boolean DEFAULT NULL,
  p_type notification_type DEFAULT NULL,
  p_from_date timestamptz DEFAULT NULL,
  p_to_date timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  type notification_type,
  is_read boolean,
  related_task_id uuid,
  related_task_title text,
  metadata jsonb,
  created_at timestamptz,
  read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.title,
    n.message,
    n.type,
    n.is_read,
    n.related_task_id,
    t.title as related_task_title,
    n.metadata,
    n.created_at,
    n.read_at
  FROM user_notifications n
  LEFT JOIN tasks t ON n.related_task_id = t.id
  WHERE 
    n.user_id = p_user_id
    AND (p_is_read IS NULL OR n.is_read = p_is_read)
    AND (p_type IS NULL OR n.type = p_type)
    AND (p_from_date IS NULL OR n.created_at >= p_from_date)
    AND (p_to_date IS NULL OR n.created_at <= p_to_date)
  ORDER BY n.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to get notification counts
CREATE OR REPLACE FUNCTION get_notification_counts(p_user_id uuid)
RETURNS TABLE (
  total_count bigint,
  unread_count bigint,
  read_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE is_read = false) as unread_count,
    COUNT(*) FILTER (WHERE is_read = true) as read_count
  FROM user_notifications
  WHERE user_id = p_user_id;
END;
$$;

-- Trigger function to create notifications for task assignments
CREATE OR REPLACE FUNCTION trigger_create_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_info record;
BEGIN
  -- Get task information
  SELECT title, priority INTO task_info
  FROM tasks 
  WHERE id = NEW.task_id;
  
  -- Create notification for the assigned worker
  PERFORM create_notification(
    NEW.worker_id,
    'Nueva tarea asignada',
    'Se te ha asignado la tarea: ' || task_info.title,
    'task_assigned',
    NEW.task_id,
    jsonb_build_object('priority', task_info.priority, 'assigned_by', NEW.assigned_by)
  );
  
  RETURN NEW;
END;
$$;

-- Trigger function to create notifications for task status changes
CREATE OR REPLACE FUNCTION trigger_create_status_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  assigned_worker record;
  status_label text;
BEGIN
  -- Only trigger on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get status display name
  SELECT label INTO status_label
  FROM task_statuses 
  WHERE value = NEW.status;
  
  -- Create notifications for all assigned workers
  FOR assigned_worker IN 
    SELECT worker_id 
    FROM task_assignments 
    WHERE task_id = NEW.id
  LOOP
    PERFORM create_notification(
      assigned_worker.worker_id,
      'Estado de tarea actualizado',
      'La tarea "' || NEW.title || '" cambió a: ' || COALESCE(status_label, NEW.status),
      'task_updated',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'priority', NEW.priority)
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS assignment_notification_trigger ON task_assignments;
CREATE TRIGGER assignment_notification_trigger
  AFTER INSERT ON task_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_assignment_notification();

DROP TRIGGER IF EXISTS status_notification_trigger ON tasks;
CREATE TRIGGER status_notification_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_status_notification();

-- Insert some sample notifications for testing (optional)
-- These will be created automatically by the triggers, but you can uncomment for immediate testing
/*
INSERT INTO user_notifications (user_id, title, message, type, is_read) 
SELECT 
  id,
  'Bienvenido a G6T-Tasker',
  'Tu cuenta ha sido configurada correctamente. ¡Comienza a gestionar tus tareas!',
  'system_alert',
  false
FROM workers 
WHERE email = 'admin@example.com';
*/