/*
  # Add task attachments support

  1. New Tables
    - `task_attachments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `file_name` (text)
      - `file_type` (text) - 'audio', 'video', 'image'
      - `file_url` (text) - URL to the file in storage
      - `file_size` (bigint) - file size in bytes
      - `duration` (integer) - duration in seconds for audio/video
      - `uploaded_by` (uuid, foreign key to workers)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `task_attachments` table
    - Add policies for authenticated users to manage attachments

  3. Storage
    - Create storage bucket for task attachments
    - Set up policies for file access
*/

-- Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('audio', 'video', 'image')),
  file_url text NOT NULL,
  file_size bigint,
  duration integer, -- duration in seconds for audio/video
  uploaded_by uuid REFERENCES workers(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all attachments"
  ON task_attachments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert attachments"
  ON task_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own attachments"
  ON task_attachments
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_file_type ON task_attachments(file_type);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Authenticated users can upload task attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can view task attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their own task attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Function to get tasks with attachments
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
  assigned_workers jsonb,
  attachments jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
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
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', w.id,
            'name', w.name,
            'email', w.email,
            'role', w.role
          )
        )
        FROM task_assignments ta
        JOIN workers w ON w.id = ta.worker_id
        WHERE ta.task_id = t.id
      ), 
      '[]'::jsonb
    ) as assigned_workers,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', att.id,
            'file_name', att.file_name,
            'file_type', att.file_type,
            'file_url', att.file_url,
            'file_size', att.file_size,
            'duration', att.duration,
            'uploaded_by', att.uploaded_by,
            'uploader_name', w.name,
            'created_at', att.created_at
          )
        )
        FROM task_attachments att
        LEFT JOIN workers w ON w.id = att.uploaded_by
        WHERE att.task_id = t.id
        ORDER BY att.created_at DESC
      ), 
      '[]'::jsonb
    ) as attachments
  FROM tasks t
  LEFT JOIN locations l ON l.id = t.location_id
  ORDER BY t.created_at DESC;
END;
$$;