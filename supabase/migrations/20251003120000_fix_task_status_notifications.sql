/*
  # Fix task status notification trigger

  1. Changes
    - Update trigger_create_status_notification to compare the task status enum against text values correctly

  2. Security
    - No changes
*/

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

  -- Get status display name using text comparison for the enum value
  SELECT label INTO status_label
  FROM task_statuses
  WHERE value = NEW.status::text;

  -- Create notifications for all assigned workers
  FOR assigned_worker IN
    SELECT worker_id
    FROM task_assignments
    WHERE task_id = NEW.id
  LOOP
    PERFORM create_notification(
      assigned_worker.worker_id,
      'Estado de tarea actualizado',
      'La tarea "' || NEW.title || '" cambió a: ' || COALESCE(status_label, NEW.status::text),
      'task_updated',
      NEW.id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'priority', NEW.priority)
    );
  END LOOP;

  RETURN NEW;
END;
$$;
