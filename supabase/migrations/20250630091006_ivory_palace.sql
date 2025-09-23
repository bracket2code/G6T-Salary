/*
  # Fix task history foreign key constraint violation

  1. Database Changes
    - Make user_id column in task_history nullable to handle cases where user doesn't exist in workers table
    - Update triggers to safely handle user_id references

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity while allowing system operations

  3. Notes
    - This fixes the foreign key constraint violation when deleting attachments
    - Allows task_history to record system actions even when user is not in workers table
*/

-- Make user_id nullable in task_history table
ALTER TABLE task_history ALTER COLUMN user_id DROP NOT NULL;

-- Create or replace the trigger function for attachment changes
CREATE OR REPLACE FUNCTION trigger_log_attachment_changes()
RETURNS TRIGGER AS $$
DECLARE
    worker_exists BOOLEAN;
    safe_user_id UUID;
BEGIN
    -- Check if the current user exists in workers table
    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM workers WHERE id = auth.uid()) INTO worker_exists;
        IF worker_exists THEN
            safe_user_id := auth.uid();
        ELSE
            safe_user_id := NULL;
        END IF;
    ELSE
        safe_user_id := NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_history (
            task_id,
            user_id,
            action_type,
            description,
            created_at
        ) VALUES (
            NEW.task_id,
            safe_user_id,
            'attachment_added',
            'Archivo adjunto añadido: ' || NEW.file_name,
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO task_history (
            task_id,
            user_id,
            action_type,
            description,
            created_at
        ) VALUES (
            OLD.task_id,
            safe_user_id,
            'attachment_removed',
            'Archivo adjunto eliminado: ' || OLD.file_name,
            NOW()
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger function for conversation changes
CREATE OR REPLACE FUNCTION trigger_log_conversation_changes()
RETURNS TRIGGER AS $$
DECLARE
    worker_exists BOOLEAN;
    safe_user_id UUID;
BEGIN
    -- Check if the current user exists in workers table
    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM workers WHERE id = auth.uid()) INTO worker_exists;
        IF worker_exists THEN
            safe_user_id := auth.uid();
        ELSE
            safe_user_id := NULL;
        END IF;
    ELSE
        safe_user_id := NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_history (
            task_id,
            user_id,
            action_type,
            description,
            created_at
        ) VALUES (
            NEW.task_id,
            safe_user_id,
            'comment_added',
            'Comentario añadido',
            NOW()
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger function for assignment changes
CREATE OR REPLACE FUNCTION trigger_log_assignment_changes()
RETURNS TRIGGER AS $$
DECLARE
    worker_exists BOOLEAN;
    safe_user_id UUID;
    worker_name TEXT;
BEGIN
    -- Check if the current user exists in workers table
    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM workers WHERE id = auth.uid()) INTO worker_exists;
        IF worker_exists THEN
            safe_user_id := auth.uid();
        ELSE
            safe_user_id := NULL;
        END IF;
    ELSE
        safe_user_id := NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Get worker name for the assignment
        SELECT name INTO worker_name FROM workers WHERE id = NEW.worker_id;
        
        INSERT INTO task_history (
            task_id,
            user_id,
            action_type,
            description,
            created_at
        ) VALUES (
            NEW.task_id,
            safe_user_id,
            'assignment_added',
            'Trabajador asignado: ' || COALESCE(worker_name, 'Usuario desconocido'),
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Get worker name for the assignment
        SELECT name INTO worker_name FROM workers WHERE id = OLD.worker_id;
        
        INSERT INTO task_history (
            task_id,
            user_id,
            action_type,
            description,
            created_at
        ) VALUES (
            OLD.task_id,
            safe_user_id,
            'assignment_removed',
            'Trabajador desasignado: ' || COALESCE(worker_name, 'Usuario desconocido'),
            NOW()
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger function for task changes
CREATE OR REPLACE FUNCTION trigger_log_task_changes()
RETURNS TRIGGER AS $$
DECLARE
    worker_exists BOOLEAN;
    safe_user_id UUID;
BEGIN
    -- Check if the current user exists in workers table
    IF auth.uid() IS NOT NULL THEN
        SELECT EXISTS(SELECT 1 FROM workers WHERE id = auth.uid()) INTO worker_exists;
        IF worker_exists THEN
            safe_user_id := auth.uid();
        ELSE
            safe_user_id := NULL;
        END IF;
    ELSE
        safe_user_id := NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO task_history (
            task_id,
            user_id,
            action_type,
            description,
            created_at
        ) VALUES (
            NEW.id,
            safe_user_id,
            'created',
            'Tarea creada',
            NOW()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log status changes
        IF OLD.status != NEW.status THEN
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
                safe_user_id,
                'status_change',
                OLD.status,
                NEW.status,
                'Estado cambiado de ' || OLD.status || ' a ' || NEW.status,
                NOW()
            );
        END IF;
        
        -- Log priority changes
        IF OLD.priority != NEW.priority THEN
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
                safe_user_id,
                'priority_change',
                OLD.priority,
                NEW.priority,
                'Prioridad cambiada de ' || OLD.priority || ' a ' || NEW.priority,
                NOW()
            );
        END IF;
        
        -- Log description changes
        IF COALESCE(OLD.description, '') != COALESCE(NEW.description, '') THEN
            INSERT INTO task_history (
                task_id,
                user_id,
                action_type,
                description,
                created_at
            ) VALUES (
                NEW.id,
                safe_user_id,
                'description_change',
                'Descripción actualizada',
                NOW()
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;