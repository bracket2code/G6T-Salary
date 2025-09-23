-- First, enable RLS if not already enabled
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Users can create own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can read all worker profiles" ON workers;
DROP POLICY IF EXISTS "Users can update own worker profile" ON workers;
DROP POLICY IF EXISTS "Users can delete own worker profile" ON workers;

-- Create new policies with correct conditions

-- Allow reading all worker profiles
CREATE POLICY "Users can read all worker profiles"
ON workers
FOR SELECT
TO authenticated
USING (true);

-- Allow creating worker profiles
CREATE POLICY "Users can create own worker profile"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow updating own worker profile
CREATE POLICY "Users can update own worker profile"
ON workers
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow deleting own worker profile
CREATE POLICY "Users can delete own worker profile"
ON workers
FOR DELETE
TO authenticated
USING (auth.uid() = id);