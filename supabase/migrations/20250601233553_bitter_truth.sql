/*
  # Add INSERT policy for workers table
  
  1. Changes
    - Add new RLS policy to allow authenticated users to create their own worker profile
    
  2. Security
    - Policy ensures users can only create a worker profile with their own auth.uid()
    - Maintains data integrity by linking auth users to worker profiles
*/

CREATE POLICY "Workers can create own profile"
  ON workers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);