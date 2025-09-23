/*
  # Update tasks table schema
  
  1. Changes
    - Drop existing tasks table
    - Create new simplified tasks table with only required fields
    - Add locations table for task locations
    
  2. Tables
    - tasks
      - id (uuid, primary key)
      - title (text)
      - description (text, nullable)
      - location_id (uuid, foreign key)
      - priority (enum: low, medium, high, critical)
      - start_date (timestamptz)
      - end_date (timestamptz)
      - created_at (timestamptz)
    
    - locations
      - id (uuid, primary key)
      - name (text)
      - created_at (timestamptz)
*/

-- Drop existing tasks table
DROP TABLE IF EXISTS tasks CASCADE;

-- Create locations table
CREATE TABLE locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create task_priority enum
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- Create tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location_id uuid REFERENCES locations(id),
  priority task_priority NOT NULL DEFAULT 'medium',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for authenticated users" ON tasks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON tasks
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users" ON locations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON locations
  FOR INSERT TO authenticated WITH CHECK (true);

-- Insert sample locations
INSERT INTO locations (name) VALUES
  ('Oficina Central'),
  ('Almacén Principal'),
  ('Planta de Producción'),
  ('Centro de Distribución');