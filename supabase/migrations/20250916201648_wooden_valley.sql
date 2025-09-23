/*
  # Fix user creation database conflicts

  1. Database Cleanup
    - Remove any conflicting demo users or orphaned records
    - Fix any constraint violations in workers table
    - Ensure proper foreign key relationships

  2. Trigger Updates
    - Update handle_new_user function to handle all edge cases
    - Better error handling and conflict resolution
    - Ensure trigger works with existing data

  3. Security
    - Maintain existing RLS policies
    - Ensure data integrity while fixing conflicts
*/

-- Clean up any problematic demo users or orphaned records
DELETE FROM workers WHERE email IN ('admin@example.com', 'demo@example.com', 'test@example.com');
DELETE FROM workers WHERE id = '00000000-0000-0000-0000-000000000000';

-- Remove any workers that don't have corresponding auth users
DELETE FROM workers 
WHERE id NOT IN (
  SELECT id FROM auth.users
) AND email NOT LIKE '%@example.com';

-- Update the handle_new_user function to be more robust
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_worker_id uuid;
BEGIN
  -- Check if a worker with this email already exists
  SELECT id INTO existing_worker_id
  FROM workers 
  WHERE email = NEW.email;
  
  IF existing_worker_id IS NOT NULL THEN
    -- If worker exists with different ID, update the ID
    IF existing_worker_id != NEW.id THEN
      UPDATE workers 
      SET 
        id = NEW.id,
        name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        role = COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')::worker_role,
        updated_at = now()
      WHERE email = NEW.email;
    ELSE
      -- Worker exists with same ID, just update metadata
      UPDATE workers 
      SET 
        name = COALESCE(NEW.raw_user_meta_data->>'name', name),
        role = COALESCE(NEW.raw_user_meta_data->>'role', role)::worker_role,
        updated_at = now()
      WHERE id = NEW.id;
    END IF;
  ELSE
    -- No worker exists, create new one
    INSERT INTO workers (id, name, email, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'tecnico')::worker_role
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now()
    ON CONFLICT (email) DO UPDATE SET
      id = EXCLUDED.id,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      updated_at = now();
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Add a function to manually sync auth users with workers (for cleanup)
CREATE OR REPLACE FUNCTION sync_auth_users_with_workers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_user record;
BEGIN
  -- For each auth user, ensure they have a worker profile
  FOR auth_user IN 
    SELECT id, email, raw_user_meta_data
    FROM auth.users
  LOOP
    INSERT INTO workers (id, name, email, role)
    VALUES (
      auth_user.id,
      COALESCE(auth_user.raw_user_meta_data->>'name', split_part(auth_user.email, '@', 1)),
      auth_user.email,
      COALESCE(auth_user.raw_user_meta_data->>'role', 'tecnico')::worker_role
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now()
    ON CONFLICT (email) DO UPDATE SET
      id = EXCLUDED.id,
      name = EXCLUDED.name,
      role = EXCLUDED.role,
      updated_at = now();
  END LOOP;
  
  RAISE NOTICE 'Auth users synced with workers table';
END;
$$;

-- Run the sync function to fix any existing inconsistencies
SELECT sync_auth_users_with_workers();

-- Drop the sync function as it's no longer needed
DROP FUNCTION sync_auth_users_with_workers();