/*
  # Fix workers table RLS policies

  1. Changes
    - Drop existing restrictive policies
    - Add new policies for proper worker profile management
    - Allow authenticated users to:
      - Insert their own profile
      - Read all worker profiles
      - Update their own profile
      - Delete their own profile (if needed)
  
  2. Security
    - Maintain RLS enabled
    - Ensure users can only manage their own profiles
    - Allow reading all workers for collaboration features
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON workers;
DROP POLICY IF EXISTS "Enable read access for all workers" ON workers;
DROP POLICY IF EXISTS "Enable update for users based on id" ON workers;

-- Create new policies
CREATE POLICY "Enable insert access for worker profiles"
ON public.workers
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow users to create their own profile
  auth.uid() = id OR
  -- Also allow creating profile if email matches (for profile creation during auth)
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.email = workers.email
    AND auth.users.id = auth.uid()
  )
);

CREATE POLICY "Enable read access for all worker profiles"
ON public.workers
FOR SELECT
TO authenticated
USING (true); -- Allow reading all workers for collaboration features

CREATE POLICY "Enable update for own worker profile"
ON public.workers
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable delete for own worker profile"
ON public.workers
FOR DELETE
TO authenticated
USING (auth.uid() = id);