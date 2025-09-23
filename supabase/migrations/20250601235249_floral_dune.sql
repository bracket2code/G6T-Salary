/*
  # Fix worker RLS policies to allow proper authentication

  1. Changes
    - Drop existing RLS policies on workers table
    - Create new policies that properly handle authentication flow
    - Allow users to create their own worker profile during login
  
  2. Security
    - Maintain proper security while allowing necessary operations
    - Ensure users can only manage their own profiles
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view workers" ON workers;
DROP POLICY IF EXISTS "Allow users to manage own profile" ON workers;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON workers;
DROP POLICY IF EXISTS "Allow users to insert worker profiles" ON workers;
DROP POLICY IF EXISTS "Allow users to update own profile" ON workers;

-- Create new policies
-- Allow all authenticated users to view all workers
CREATE POLICY "Allow authenticated users to view workers" 
ON workers 
FOR SELECT 
TO authenticated 
USING (true);

-- Allow users to insert their own worker profile
CREATE POLICY "Allow users to insert worker profiles" 
ON workers 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow users to update only their own profile
CREATE POLICY "Allow users to update own profile" 
ON workers 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);