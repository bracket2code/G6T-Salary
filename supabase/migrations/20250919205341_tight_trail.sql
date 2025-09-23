/*
  # Create user profile function and external data table

  1. New Tables
    - `user_external_data`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to workers)
      - `worker_id_relation` (text, ID del worker en API externa)
      - `full_name` (text, nombre completo)
      - `dni` (text)
      - `direccion` (text)
      - `phone` (text)
      - `empresas` (text, nombres de empresas separados por •)
      - `company_ids` (text[], array de IDs de empresas)
      - `tipo_empleado` (text)
      - `fecha_nacimiento` (date)
      - `fecha_alta` (date)
      - `estado` (text)
      - `organization` (text)
      - `last_sync_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Functions
    - `get_user_complete_profile` - Returns complete user profile with external data

  3. Security
    - Enable RLS on `user_external_data` table
    - Add policies for authenticated users to read their own data
*/

-- Create table for external user data if it doesn't exist
CREATE TABLE IF NOT EXISTS user_external_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  worker_id_relation text,
  full_name text,
  dni text,
  direccion text,
  phone text,
  empresas text, -- Company names separated by •
  company_ids text[], -- Array of company IDs
  tipo_empleado text,
  fecha_nacimiento date,
  fecha_alta date,
  estado text,
  organization text,
  last_sync_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_external_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_external_data' 
    AND policyname = 'Users can view their own external data'
  ) THEN
    CREATE POLICY "Users can view their own external data"
      ON user_external_data
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_external_data' 
    AND policyname = 'Users can insert their own external data'
  ) THEN
    CREATE POLICY "Users can insert their own external data"
      ON user_external_data
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_external_data' 
    AND policyname = 'Users can update their own external data'
  ) THEN
    CREATE POLICY "Users can update their own external data"
      ON user_external_data
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_external_data_user_id ON user_external_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_external_data_worker_id_relation ON user_external_data(worker_id_relation);
CREATE INDEX IF NOT EXISTS idx_user_external_data_last_sync ON user_external_data(last_sync_at);

-- Create or replace the function to get complete user profile
CREATE OR REPLACE FUNCTION get_user_complete_profile(p_user_id uuid)
RETURNS TABLE (
  -- Basic worker data
  id uuid,
  name text,
  email text,
  role worker_role,
  phone text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  -- External data
  worker_id_relation text,
  full_name text,
  dni text,
  direccion text,
  external_phone text,
  empresas text,
  company_ids text[],
  tipo_empleado text,
  fecha_nacimiento date,
  fecha_alta date,
  estado text,
  organization text,
  last_sync_at timestamptz,
  -- Metadata
  has_external_data boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    w.id,
    w.name,
    w.email,
    w.role,
    w.phone,
    w.avatar_url,
    w.created_at,
    w.updated_at,
    -- External data
    ued.worker_id_relation,
    ued.full_name,
    ued.dni,
    ued.direccion,
    ued.phone as external_phone,
    ued.empresas,
    ued.company_ids,
    ued.tipo_empleado,
    ued.fecha_nacimiento,
    ued.fecha_alta,
    ued.estado,
    ued.organization,
    ued.last_sync_at,
    -- Metadata
    (ued.id IS NOT NULL) as has_external_data
  FROM workers w
  LEFT JOIN user_external_data ued ON w.id = ued.user_id
  WHERE w.id = p_user_id;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_complete_profile(uuid) TO authenticated;