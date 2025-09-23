/*
  # Fix workers table RLS policies for upsert operations

  1. Changes
    - Drop all existing RLS policies on workers table
    - Create new RLS policies that properly handle upsert operations
    - Ensure authenticated users can create and update their own worker profiles
    
  2. Security
    - Enable RLS on workers table
    - Add policies for:
      - SELECT: Users can read their own profile
      - INSERT: Users can create their own profile (id must match auth.uid())
      - UPDATE: Users can update their own profile (id must match auth.uid())
      - DELETE: Users can delete their own profile
*/

-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can read own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can create own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can update own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can delete own worker profile" ON workers;
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
USING (auth.uid() = id);

-- Policy for creating worker profiles
CREATE POLICY "Users can create own worker profile"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

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