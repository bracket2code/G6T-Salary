/*
  # Fix RLS policies for workers table

  1. Changes
    - Fix INSERT policy to use auth.uid() instead of uid()
    - Fix UPDATE policy to use auth.uid() instead of uid()
  
  2. Security
    - Ensures proper RLS function usage for authentication checks
*/

-- Drop existing policies that use incorrect uid() function
DROP POLICY IF EXISTS "Allow users to insert worker profiles" ON workers;
DROP POLICY IF EXISTS "Allow users to update own profile" ON workers;

-- Recreate policies with correct auth.uid() function
CREATE POLICY "Allow users to insert worker profiles"
  ON workers
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Allow users to update own profile"
  ON workers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);