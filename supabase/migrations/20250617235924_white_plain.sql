/*
  # Fix user_skills RLS policy for admin operations

  1. Policy Updates
    - Update INSERT policy to allow admins and supervisors to add skills for any user
    - Keep existing policies for users to manage their own skills
    - Ensure proper role-based access control

  2. Security
    - Admins and supervisors can add skills for any user
    - Regular users can only add skills for themselves
    - All authenticated users can view skills (existing policy)
*/

-- Drop the existing INSERT policy that's too restrictive
DROP POLICY IF EXISTS "Usuarios pueden crear asignaciones" ON user_skills;

-- Create a new INSERT policy that allows:
-- 1. Users to add skills for themselves
-- 2. Admins and supervisors to add skills for any user
CREATE POLICY "Users can insert skills with role check"
  ON user_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can add skills for themselves
    auth.uid() = user_id
    OR
    -- Admin or supervisor can add skills for any user
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role IN ('admin', 'supervisor')
    )
  );

-- Also update the ALL policy to be more specific and consistent
DROP POLICY IF EXISTS "Usuarios pueden gestionar sus especialidades" ON user_skills;

-- Create separate policies for UPDATE and DELETE
CREATE POLICY "Users can update own skills or admins can update any"
  ON user_skills
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "Users can delete own skills or admins can delete any"
  ON user_skills
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role IN ('admin', 'supervisor')
    )
  );