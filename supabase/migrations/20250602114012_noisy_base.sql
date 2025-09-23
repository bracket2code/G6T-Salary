/*
  # Add delete policy for tasks table

  1. Changes
    - Add RLS policy to allow authenticated users to delete tasks
*/

CREATE POLICY "Enable delete access for authenticated users"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (true);