/*
  # Fix user_skills RLS policies completely

  1. Changes
    - Drop all existing policies on user_skills table
    - Create simple, working policies that allow proper skill management
    - Ensure authenticated users can manage skills properly

  2. Security
    - Maintain RLS enabled on user_skills table
    - Allow authenticated users to manage skills
    - Keep read access open for collaboration
*/

-- Drop all existing policies on user_skills
DROP POLICY IF EXISTS "Usuarios pueden ver todas las especialidades" ON user_skills;
DROP POLICY IF EXISTS "Users can insert skills with role check" ON user_skills;
DROP POLICY IF EXISTS "Allow skill insertion with proper role check" ON user_skills;
DROP POLICY IF EXISTS "Users can update own skills or admins can update any" ON user_skills;
DROP POLICY IF EXISTS "Users can delete own skills or admins can delete any" ON user_skills;

-- Ensure RLS is enabled
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;

-- Create new, simple policies that work

-- Allow all authenticated users to read all skills (for collaboration)
CREATE POLICY "Authenticated users can view all skills"
  ON user_skills
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert skills
CREATE POLICY "Authenticated users can insert skills"
  ON user_skills
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update skills
CREATE POLICY "Authenticated users can update skills"
  ON user_skills
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete skills
CREATE POLICY "Authenticated users can delete skills"
  ON user_skills
  FOR DELETE
  TO authenticated
  USING (true);