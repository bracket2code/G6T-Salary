/*
  # Make start_date optional in tasks table

  1. Changes
    - Remove NOT NULL constraint from start_date column in tasks table
    - Allow tasks to be created without a start date
    - Update validation to make start_date optional

  2. Security
    - No changes to RLS policies needed
*/

-- Remove NOT NULL constraint from start_date column
ALTER TABLE tasks ALTER COLUMN start_date DROP NOT NULL;