/*
  # Fix user_skills INSERT policy

  1. Policy Updates
    - Drop existing INSERT policy that's causing issues
    - Create new INSERT policy that properly allows:
      - Users to insert skills for themselves (user_id = auth.uid())
      - Admins and supervisors to insert skills for any user
  
  2. Security
    - Maintains RLS protection
    - Ensures proper role-based access control
    - Allows self-management of skills for regular users
*/

-- Drop the existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "Users can insert skills with role check" ON user_skills;

-- Create a new INSERT policy that properly handles permissions
CREATE POLICY "Allow skill insertion with proper role check"
  ON user_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow users to insert skills for themselves
    (auth.uid() = user_id) 
    OR 
    -- Allow admins and supervisors to insert skills for any user
    (EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role IN ('admin', 'supervisor')
    ))
  );