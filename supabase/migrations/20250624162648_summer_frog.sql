/*
  # Fix task_history foreign key constraint

  1. Changes
    - Make user_id column nullable in task_history table
    - Update foreign key constraint to SET NULL on delete
    - This prevents constraint violations when users are deleted or when triggers try to log actions

  2. Security
    - Maintains existing RLS policies
    - No changes to permissions
*/

-- First, make the user_id column nullable if it's not already
ALTER TABLE public.task_history 
ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE public.task_history 
DROP CONSTRAINT IF EXISTS task_history_user_id_fkey;

-- Add the new foreign key constraint with ON DELETE SET NULL
ALTER TABLE public.task_history 
ADD CONSTRAINT task_history_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.workers(id) ON DELETE SET NULL;