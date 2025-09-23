/*
  # Add task status and priority enums
  
  1. New Types
    - task_status enum
    - task_priority enum
  
  2. Functions
    - get_task_statuses(): Returns status values with labels
    - get_task_priorities(): Returns priority values with labels
*/

-- Create enum types if they don't exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('pendiente', 'en_progreso', 'completada', 'cancelada');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE task_priority AS ENUM ('baja', 'media', 'alta', 'critica');
  END IF;
END $$;

-- Function to get all task statuses
CREATE OR REPLACE FUNCTION get_task_statuses()
RETURNS TABLE (value text, label text)
LANGUAGE sql
STABLE
AS $$
  WITH status_values AS (
    SELECT unnest(enum_range(NULL::task_status))::text as status_value
  )
  SELECT 
    status_value as value,
    CASE status_value
      WHEN 'pendiente' THEN 'Pendiente'
      WHEN 'en_progreso' THEN 'En Progreso'
      WHEN 'completada' THEN 'Completada'
      WHEN 'cancelada' THEN 'Cancelada'
    END as label
  FROM status_values;
$$;

-- Function to get all task priorities
CREATE OR REPLACE FUNCTION get_task_priorities()
RETURNS TABLE (value text, label text)
LANGUAGE sql
STABLE
AS $$
  WITH priority_values AS (
    SELECT unnest(enum_range(NULL::task_priority))::text as priority_value
  )
  SELECT 
    priority_value as value,
    CASE priority_value
      WHEN 'baja' THEN 'Baja'
      WHEN 'media' THEN 'Media'
      WHEN 'alta' THEN 'Alta'
      WHEN 'critica' THEN 'Crítica'
    END as label
  FROM priority_values;
$$;