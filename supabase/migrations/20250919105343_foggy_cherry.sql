/*
  # Fix foreign key constraint for locations table

  1. Changes
    - Drop existing foreign key constraint on tasks.location_id
    - Add new foreign key constraint with ON DELETE SET NULL
    - This allows deleting locations without breaking tasks

  2. Security
    - Maintains data integrity
    - Prevents orphaned references
    - Allows safe cleanup of duplicate locations
*/

-- Drop the existing foreign key constraint
ALTER TABLE tasks
DROP CONSTRAINT IF EXISTS tasks_location_id_fkey;

-- Add new foreign key constraint with ON DELETE SET NULL
ALTER TABLE tasks
ADD CONSTRAINT tasks_location_id_fkey
FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON CONSTRAINT tasks_location_id_fkey ON tasks IS 'Foreign key to locations table with ON DELETE SET NULL to allow safe location cleanup';