/*
  # Create user locations table and update functions

  1. New Tables
    - `user_locations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to workers)
      - `location_id` (uuid, foreign key to locations)
      - `created_at` (timestamp)
      - Unique constraint on (user_id, location_id)

  2. Security
    - Enable RLS on `user_locations` table
    - Add policies for authenticated users to view, insert, and delete location assignments

  3. Functions
    - Drop existing `get_users_with_skills` function
    - Recreate with new return type that includes locations data

  4. Indexes
    - Add performance indexes on user_id and location_id
*/

-- Create user_locations table
CREATE TABLE IF NOT EXISTS user_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, location_id)
);

-- Enable RLS
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all location assignments"
  ON user_locations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert location assignments"
  ON user_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete location assignments"
  ON user_locations
  FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_locations_user_id ON user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_locations_location_id ON user_locations(location_id);

-- Drop the existing function first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_users_with_skills();

-- Recreate the get_users_with_skills function to include locations
CREATE OR REPLACE FUNCTION get_users_with_skills()
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  user_role worker_role,
  user_phone text,
  user_avatar_url text,
  user_created_at timestamptz,
  user_updated_at timestamptz,
  skills jsonb,
  locations jsonb
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id as user_id,
    w.name as user_name,
    w.email as user_email,
    w.role as user_role,
    w.phone as user_phone,
    w.avatar_url as user_avatar_url,
    w.created_at as user_created_at,
    w.updated_at as user_updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', us.id,
            'skill_type', us.skill_type,
            'skill_level', us.skill_level,
            'created_at', us.created_at,
            'updated_at', us.updated_at
          )
        )
        FROM user_skills us
        WHERE us.user_id = w.id
      ), 
      '[]'::jsonb
    ) as skills,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', ul.id,
            'location_id', ul.location_id,
            'location_name', l.name,
            'created_at', ul.created_at
          )
        )
        FROM user_locations ul
        JOIN locations l ON l.id = ul.location_id
        WHERE ul.user_id = w.id
      ), 
      '[]'::jsonb
    ) as locations
  FROM workers w
  ORDER BY w.name;
END;
$$;