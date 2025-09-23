/*
  # Fix worker policies and constraints

  This migration fixes the Row Level Security (RLS) policies for the workers table
  and ensures proper handling of worker profiles.
*/

-- First, drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow authenticated users to view workers" ON workers;
DROP POLICY IF EXISTS "Allow users to manage own profile" ON workers;
DROP POLICY IF EXISTS "Allow users to insert own profile" ON workers;
DROP POLICY IF EXISTS "Workers can create own profile" ON workers;
DROP POLICY IF EXISTS "Workers can read own data" ON workers;
DROP POLICY IF EXISTS "Workers can update own data" ON workers;

-- Drop existing triggers
DROP TRIGGER IF EXISTS handle_worker_profile_trigger ON workers;
DROP FUNCTION IF EXISTS handle_worker_profile();

-- Create simple, straightforward policies
CREATE POLICY "Allow authenticated users to view workers"
ON workers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow users to update own profile"
ON workers
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow users to insert worker profiles"
ON workers
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Create the updated_at trigger (if not exists)
-- This ensures updated_at is set whenever a row is updated
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS update_workers_updated_at ON workers;
CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON workers
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();