/*
  # Fix get_tasks_with_attachments function

  1. Problem
    - The `get_tasks_with_attachments` function has a SQL error where `att.created_at` column 
      is being selected without being in GROUP BY clause or aggregate function
    
  2. Solution
    - Recreate the function with proper aggregation of attachment data
    - Use json_agg to collect all attachment details into a JSON array
    - Ensure all non-aggregated columns are in the GROUP BY clause

  3. Changes
    - Drop and recreate the `get_tasks_with_attachments` function
    - Properly aggregate attachment data using json_agg
    - Include all task and location columns in GROUP BY
    - Handle cases where tasks have no attachments
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_tasks_with_attachments();

-- Create the corrected function
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
  attachments json
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
    ) as attachments
  FROM tasks t
  LEFT JOIN locations l ON t.location_id = l.id
  LEFT JOIN task_assignments ta ON t.id = ta.task_id
  LEFT JOIN workers w ON ta.worker_id = w.id
  LEFT JOIN task_attachments att ON t.id = att.task_id
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