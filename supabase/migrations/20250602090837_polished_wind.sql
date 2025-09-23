/*
  # Update tasks table and add task status

  1. Changes
    - Add status column to tasks table
    - Add update policy for tasks
    - Add updated_at column and trigger
  
  2. Security
    - Maintain RLS protection
    - Add policy for task updates
*/

-- Add status enum
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Add status and updated_at columns
ALTER TABLE tasks 
ADD COLUMN status task_status NOT NULL DEFAULT 'pending',
ADD COLUMN updated_at timestamptz;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Add update policy
CREATE POLICY "Enable update access for authenticated users" ON tasks
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);