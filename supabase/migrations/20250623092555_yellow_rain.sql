/*
  # Add task statuses table and data

  1. New Tables
    - `task_statuses`
      - `id` (uuid, primary key)
      - `value` (text, unique) - the enum value
      - `label` (text) - display name
      - `description` (text, optional) - description
      - `color` (text, optional) - color for UI
      - `order_index` (integer) - for ordering
      - `is_active` (boolean) - to enable/disable statuses
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `task_statuses` table
    - Add policy for authenticated users to read statuses
    - Add policy for admins to manage statuses

  3. Data
    - Insert default task statuses with proper ordering and colors
*/

-- Drop existing function if it exists to avoid conflicts
DROP FUNCTION IF EXISTS get_task_statuses();

-- Create task_statuses table
CREATE TABLE IF NOT EXISTS task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  color text DEFAULT '#6b7280',
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);

-- Enable RLS
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read task statuses"
  ON task_statuses
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage task statuses"
  ON task_statuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role = 'admin'
    )
  );

-- Insert default task statuses
INSERT INTO task_statuses (value, label, description, color, order_index) VALUES
  ('sin_asignar', 'Sin Asignar', 'Tarea creada pero sin asignar a ningún técnico', '#f97316', 1),
  ('pendiente', 'Pendiente', 'Tarea asignada pero no iniciada', '#6b7280', 2),
  ('en_proceso', 'En Proceso', 'Tarea en curso de ejecución', '#3b82f6', 3),
  ('aplazada', 'Aplazada', 'Tarea temporalmente suspendida', '#eab308', 4),
  ('completada', 'Completada', 'Tarea finalizada exitosamente', '#10b981', 5),
  ('cancelada', 'Cancelada', 'Tarea cancelada sin completar', '#ef4444', 6),
  ('archivada', 'Archivada', 'Tarea archivada para referencia', '#9ca3af', 7)
ON CONFLICT (value) DO NOTHING;

-- Create function to get task statuses
CREATE OR REPLACE FUNCTION get_task_statuses()
RETURNS TABLE (
  value text,
  label text,
  description text,
  color text,
  order_index integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ts.value,
    ts.label,
    ts.description,
    ts.color,
    ts.order_index
  FROM task_statuses ts
  WHERE ts.is_active = true
  ORDER BY ts.order_index ASC, ts.label ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Create trigger for task_statuses table
DROP TRIGGER IF EXISTS update_task_statuses_updated_at ON task_statuses;
CREATE TRIGGER update_task_statuses_updated_at
  BEFORE UPDATE ON task_statuses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();