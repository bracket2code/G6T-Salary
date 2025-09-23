/*
  # Fix workers table RLS policies

  1. Changes
    - Drop existing RLS policies on workers table that are too restrictive
    - Add new policies to allow:
      - Authenticated users to create their own worker profile
      - Authenticated users to read all worker profiles (needed for team features)
      - Users to update their own profile only
      
  2. Security
    - Maintains RLS enabled on workers table
    - Ensures users can only modify their own profile
    - Allows reading all worker profiles for team collaboration
    - Restricts profile creation to authenticated users only
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view workers" ON workers;
DROP POLICY IF EXISTS "Allow users to insert worker profiles" ON workers;
DROP POLICY IF EXISTS "Allow users to update own profile" ON workers;

-- Add new policies
CREATE POLICY "Enable read access for all workers"
ON workers FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON workers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id"
ON workers FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);