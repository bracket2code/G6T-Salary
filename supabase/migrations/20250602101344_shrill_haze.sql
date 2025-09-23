/*
  # Update workers table RLS policies

  1. Security Changes
    - Enable RLS on workers table
    - Add policies for authenticated users to:
      - Read their own worker profile
      - Create their own worker profile
      - Update their own worker profile
      - Delete their own worker profile
    
  2. Changes
    - Removes existing policies and creates new ones with proper conditions
    - Ensures proper access control for worker profiles
*/

-- First, enable RLS if not already enabled
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can create own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can read own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can update own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can delete own worker profile" ON workers;

-- Create new policies with correct conditions

-- Allow users to create their own worker profile
CREATE POLICY "Users can create own worker profile"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.email = workers.email 
    AND auth.users.id = auth.uid()
  )
);

-- Allow users to read their own worker profile
CREATE POLICY "Users can read own worker profile"
ON workers
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR 
  EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.email = workers.email 
    AND auth.users.id = auth.uid()
  )
);

-- Allow users to update their own worker profile
CREATE POLICY "Users can update own worker profile"
ON workers
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to delete their own worker profile
CREATE POLICY "Users can delete own worker profile"
ON workers
FOR DELETE
TO authenticated
USING (auth.uid() = id);