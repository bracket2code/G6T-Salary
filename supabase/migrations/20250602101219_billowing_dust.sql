/*
  # Fix workers table RLS policies

  1. Changes
    - Drop existing RLS policies on workers table
    - Create new RLS policies that properly handle:
      - Initial worker profile creation during signup
      - Reading own worker profile
      - Updating own worker profile
      - Deleting own worker profile
    
  2. Security
    - Enable RLS on workers table
    - Add policies for:
      - SELECT: Users can read their own profile
      - INSERT: Users can create their profile during signup
      - UPDATE: Users can update their own profile
      - DELETE: Users can delete their own profile
    
  Note: The policies are designed to work with the auth.uid() function
  to ensure users can only access their own data
*/

-- First drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable delete for own worker profile" ON workers;
DROP POLICY IF EXISTS "Enable insert access for worker profiles" ON workers;
DROP POLICY IF EXISTS "Enable read access for all worker profiles" ON workers;
DROP POLICY IF EXISTS "Enable update for own worker profile" ON workers;

-- Ensure RLS is enabled
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Policy for reading worker profiles
CREATE POLICY "Users can read own worker profile"
ON workers
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.email = workers.email 
    AND auth.users.id = auth.uid()
  )
);

-- Policy for creating worker profiles
CREATE POLICY "Users can create own worker profile"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.email = workers.email 
    AND auth.users.id = auth.uid()
  )
);

-- Policy for updating worker profiles
CREATE POLICY "Users can update own worker profile"
ON workers
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy for deleting worker profiles
CREATE POLICY "Users can delete own worker profile"
ON workers
FOR DELETE
TO authenticated
USING (auth.uid() = id);