/*
  # Fix handle_new_user trigger to handle conflicts

  1. Changes
    - Update handle_new_user function to use UPSERT instead of INSERT
    - Handle cases where worker profile already exists
    - Prevent unique constraint violations

  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity while allowing updates
*/

-- Update the handle_new_user function to handle conflicts
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
    updated_at = now();
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;