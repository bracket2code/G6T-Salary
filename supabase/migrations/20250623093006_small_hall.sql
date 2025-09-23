/*
  # Add 'archivada' status to task_status enum

  1. Database Changes
    - Add 'archivada' value to the task_status enum type
    - This allows tasks to be marked as archived

  2. Security
    - No changes to RLS policies needed
    - Existing policies will work with the new status value

  3. Notes
    - This migration adds a new status option for task management
    - The 'archivada' status represents archived/completed tasks that are no longer active
*/

-- Add 'archivada' to the task_status enum
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'archivada';