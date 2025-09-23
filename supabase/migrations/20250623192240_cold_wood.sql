/*
  # Add task skills system

  1. New Tables
    - `task_skills`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `skill_type` (skill_type enum)
      - `created_at` (timestamp)
      - Unique constraint on (task_id, skill_type)

  2. Security
    - Enable RLS on `task_skills` table
    - Add policies for authenticated users to manage task skills

  3. Functions
    - Drop and recreate `get_tasks_with_attachments` function to include required_skills
    - Add validation function for task attachments (if not exists)

  4. Indexes
    - Add performance indexes on task_id and skill_type
*/

-- Create task_skills table
CREATE TABLE IF NOT EXISTS task_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  skill_type skill_type NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, skill_type)
);

-- Enable RLS
ALTER TABLE task_skills ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view task skills"
  ON task_skills
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert task skills"
  ON task_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task skills"
  ON task_skills
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_skills_task_id ON task_skills(task_id);
CREATE INDEX IF NOT EXISTS idx_task_skills_skill_type ON task_skills(skill_type);

-- Function to validate task attachment task_id (only create if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'validate_task_attachment_task_id'
  ) THEN
    CREATE OR REPLACE FUNCTION validate_task_attachment_task_id()
    RETURNS TRIGGER AS $func$
    BEGIN
      -- Check if task exists
      IF NOT EXISTS (SELECT 1 FROM tasks WHERE id = NEW.task_id) THEN
        RAISE EXCEPTION 'Task with id % does not exist', NEW.task_id;
      END IF;
      
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger for task_attachments validation (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'validate_task_attachment_task_id_trigger'
  ) THEN
    CREATE TRIGGER validate_task_attachment_task_id_trigger
      BEFORE INSERT OR UPDATE ON task_attachments
      FOR EACH ROW
      EXECUTE FUNCTION validate_task_attachment_task_id();
  END IF;
END $$;

-- Drop existing function to avoid return type conflicts
DROP FUNCTION IF EXISTS get_tasks_with_attachments();

-- Recreate get_tasks_with_attachments function to include task skills
CREATE OR REPLACE FUNCTION get_tasks_with_attachments()
RETURNS TABLE (
  task_id uuid,
  task_title text,
  task_description text,
  task_status task_status,
  task_priority task_priority,
  task_location_id uuid,
  task_location_name text,
  task_created_at timestamptz,
  task_updated_at timestamptz,
  task_start_date timestamptz,
  task_end_date timestamptz,
  assigned_workers json,
  attachments json,
  required_skills json
) 
LANGUAGE sql
AS $$
  SELECT 
    t.id as task_id,
    t.title as task_title,
    t.description as task_description,
    t.status as task_status,
    t.priority as task_priority,
    t.location_id as task_location_id,
    l.name as task_location_name,
    t.created_at as task_created_at,
    t.updated_at as task_updated_at,
    t.start_date as task_start_date,
    t.end_date as task_end_date,
    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'id', w.id,
          'name', w.name,
          'email', w.email,
          'role', w.role
        )
      ) FILTER (WHERE w.id IS NOT NULL),
      '[]'::json
    ) as assigned_workers,
    COALESCE(
      json_agg(
        DISTINCT jsonb_build_object(
          'id', att.id,
          'fileName', att.file_name,
          'fileType', att.file_type,
          'fileUrl', att.file_url,
          'fileSize', att.file_size,
          'duration', att.duration,
          'uploadedBy', att.uploaded_by,
          'createdAt', att.created_at
        )
      ) FILTER (WHERE att.id IS NOT NULL),
      '[]'::json
    ) as attachments,
    COALESCE(
      json_agg(
        DISTINCT ts.skill_type
      ) FILTER (WHERE ts.skill_type IS NOT NULL),
      '[]'::json
    ) as required_skills
  FROM tasks t
  LEFT JOIN locations l ON t.location_id = l.id
  LEFT JOIN task_assignments ta ON t.id = ta.task_id
  LEFT JOIN workers w ON ta.worker_id = w.id
  LEFT JOIN task_attachments att ON t.id = att.task_id
  LEFT JOIN task_skills ts ON t.id = ts.task_id
  GROUP BY 
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.location_id,
    l.name,
    t.created_at,
    t.updated_at,
    t.start_date,
    t.end_date
  ORDER BY t.created_at DESC;
$$;