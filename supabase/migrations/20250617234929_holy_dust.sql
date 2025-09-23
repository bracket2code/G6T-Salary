/*
  # Crear sistema de asignación de tareas

  1. Nuevas Tablas
    - `task_assignments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, foreign key to tasks)
      - `worker_id` (uuid, foreign key to workers)
      - `assigned_at` (timestamptz)
      - `assigned_by` (uuid, foreign key to workers)
      - `created_at` (timestamptz)

  2. Seguridad
    - Habilitar RLS en `task_assignments`
    - Agregar políticas para usuarios autenticados

  3. Funciones
    - Función para obtener tareas con asignaciones
    - Función para asignar/desasignar tareas
*/

-- Crear tabla de asignaciones de tareas
CREATE TABLE IF NOT EXISTS task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES workers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, worker_id)
);

-- Habilitar RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS
CREATE POLICY "Usuarios pueden ver todas las asignaciones"
  ON task_assignments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden crear asignaciones"
  ON task_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios pueden eliminar asignaciones"
  ON task_assignments
  FOR DELETE
  TO authenticated
  USING (true);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_worker_id ON task_assignments(worker_id);

-- Función para obtener tareas con sus asignaciones
CREATE OR REPLACE FUNCTION get_tasks_with_assignments()
RETURNS TABLE (
  task_id uuid,
  task_title text,
  task_description text,
  task_status task_status,
  task_priority task_priority,
  task_location_id uuid,
  task_location_name text,
  task_start_date timestamptz,
  task_end_date timestamptz,
  task_created_at timestamptz,
  task_updated_at timestamptz,
  assigned_workers jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    t.id as task_id,
    t.title as task_title,
    t.description as task_description,
    t.status as task_status,
    t.priority as task_priority,
    t.location_id as task_location_id,
    l.name as task_location_name,
    t.start_date as task_start_date,
    t.end_date as task_end_date,
    t.created_at as task_created_at,
    t.updated_at as task_updated_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', w.id,
          'name', w.name,
          'email', w.email,
          'role', w.role,
          'assigned_at', ta.assigned_at
        )
      ) FILTER (WHERE w.id IS NOT NULL),
      '[]'::jsonb
    ) as assigned_workers
  FROM tasks t
  LEFT JOIN locations l ON t.location_id = l.id
  LEFT JOIN task_assignments ta ON t.id = ta.task_id
  LEFT JOIN workers w ON ta.worker_id = w.id
  GROUP BY t.id, l.name
  ORDER BY t.created_at DESC;
$$;