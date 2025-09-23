/*
  # Fix workers table RLS policies

  1. Changes
    - Drop existing policies to avoid conflicts
    - Enable RLS on workers table
    - Add new policies for:
      - Reading all worker profiles (needed for task assignments and collaboration)
      - Creating worker profiles (matching either auth ID or email)
      - Updating own worker profile
      - Deleting own worker profile

  2. Security
    - Ensures users can only modify their own profiles
    - Allows reading all worker profiles for collaboration features
    - Maintains data integrity with proper checks
*/

-- First, enable RLS if not already enabled
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can create own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can read own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can update own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can delete own worker profile" ON workers;

-- Create new policies with correct conditions

-- Allow reading all worker profiles for collaboration features
CREATE POLICY "Users can read all worker profiles"
ON workers
FOR SELECT
TO authenticated
USING (true);

-- Allow users to create their own worker profile
CREATE POLICY "Users can create own worker profile"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if the ID matches the authenticated user
  auth.uid() = id OR
  -- Or if the email matches the authenticated user's email
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