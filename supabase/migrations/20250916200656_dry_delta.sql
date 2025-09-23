/*
  # Fix user creation conflicts

  1. Changes
    - Update handle_new_user trigger to properly handle existing users
    - Remove demo user that might be causing conflicts
    - Ensure trigger uses UPSERT instead of INSERT

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity while preventing conflicts
*/

-- First, remove any demo users that might be causing conflicts
DELETE FROM workers WHERE email = 'admin@example.com' OR id = '00000000-0000-0000-0000-000000000000';

-- Update the handle_new_user function to properly handle conflicts
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Use INSERT ... ON CONFLICT to handle existing worker profiles
  INSERT INTO public.workers (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')::worker_role
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    email = NEW.email,
    role = COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')::worker_role,
    updated_at = now()
  ON CONFLICT (email) DO UPDATE SET
    id = NEW.id,
    name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    role = COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')::worker_role,
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();