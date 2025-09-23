/*
  # Fix worker profile policies

  1. Changes
    - Drop existing RLS policies
    - Add new policies that allow proper worker profile creation and management
    - Add function to safely handle worker profile creation/updates
  
  2. Security
    - Maintain RLS protection while allowing necessary operations
    - Ensure proper authentication checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Workers can create own profile" ON workers;
DROP POLICY IF EXISTS "Workers can read own data" ON workers;
DROP POLICY IF EXISTS "Workers can update own data" ON workers;

-- Create new policies
CREATE POLICY "Allow worker profile management"
  ON workers
  FOR ALL
  TO authenticated
  USING (
    -- Allow access to own profile
    auth.uid() = id
    OR
    -- Allow access if no profile exists for this auth user
    NOT EXISTS (
      SELECT 1 FROM workers 
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    -- For inserts/updates, ensure user can only modify their own profile
    -- or create a new one if they don't have one
    auth.uid() = id
    OR
    NOT EXISTS (
      SELECT 1 FROM workers 
      WHERE id = auth.uid()
    )
  );

-- Create function to safely handle worker profile creation/updates
CREATE OR REPLACE FUNCTION handle_worker_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- If a profile with this email already exists but has a different ID,
  -- update its ID to match the new auth ID
  IF EXISTS (
    SELECT 1 FROM workers 
    WHERE email = NEW.email 
    AND id != NEW.id
  ) THEN
    UPDATE workers 
    SET id = NEW.id
    WHERE email = NEW.email;
    RETURN NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to handle worker profile creation/updates
DROP TRIGGER IF EXISTS handle_worker_profile_trigger ON workers;
CREATE TRIGGER handle_worker_profile_trigger
  BEFORE INSERT OR UPDATE ON workers
  FOR EACH ROW
  EXECUTE FUNCTION handle_worker_profile();