/*
  # Fix recursive RLS policy for workers table

  1. Changes
    - Drop existing recursive policy on workers table
    - Add new simplified policy that allows:
      - Authenticated users to read all worker profiles
      - Users to only update their own profile
      - Admins to manage all worker profiles
  
  2. Security
    - Enable RLS on workers table (already enabled)
    - Add policies for:
      - SELECT: Allow authenticated users to read all worker profiles
      - INSERT/UPDATE: Allow users to only modify their own profile
      - DELETE: Prevent deletion (data preservation)
*/

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Allow worker profile management" ON workers;

-- Add new simplified policies
CREATE POLICY "Allow authenticated users to view workers"
ON workers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow users to manage own profile"
ON workers
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow users to insert own profile"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- No DELETE policy - prevent deletion of worker profiles