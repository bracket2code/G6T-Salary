/*
  # Create workers table and demo user

  1. New Tables
    - `workers`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text, unique)
      - `role` (enum: admin, manager, technician)
      - `phone` (text, nullable)
      - `created_at` (timestamp with timezone)
      - `updated_at` (timestamp with timezone)
      - `avatar_url` (text, nullable)

  2. Security
    - Enable RLS on `workers` table
    - Add policies for authenticated users
    - Create trigger for updated_at

  3. Initial Data
    - Insert demo admin user
*/

-- Create worker_role enum
CREATE TYPE worker_role AS ENUM ('admin', 'manager', 'technician');

-- Create workers table
CREATE TABLE IF NOT EXISTS workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role worker_role NOT NULL DEFAULT 'technician',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  avatar_url text
);

-- Enable RLS
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Workers can read own data"
  ON workers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Workers can update own data"
  ON workers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workers_updated_at
  BEFORE UPDATE ON workers
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Insert demo admin user
INSERT INTO workers (id, name, email, role)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Demo Admin',
  'admin@example.com',
  'admin'
);