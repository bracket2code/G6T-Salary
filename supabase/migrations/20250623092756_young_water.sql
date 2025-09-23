/*
  # Add missing sin_asignar status to task_status enum

  1. Changes
    - Add 'sin_asignar' to the task_status enum type
    - This resolves the 400 error when querying tasks with status 'sin_asignar'

  2. Notes
    - The application code expects 'sin_asignar' status but it's missing from the database enum
    - This migration adds the missing enum value to align database with application expectations
*/

-- Add 'sin_asignar' to the task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'sin_asignar';