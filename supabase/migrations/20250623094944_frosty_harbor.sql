/*
  # Add 'aplazada' status to task_status enum

  1. Database Changes
    - Add 'aplazada' to the task_status enum type
    - Insert corresponding record in task_statuses table

  2. Security
    - No changes to existing RLS policies needed
*/

-- Add 'aplazada' to the task_status enum
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'aplazada';

-- Insert the aplazada status into task_statuses table if it doesn't exist
INSERT INTO task_statuses (value, label, description, color, order_index, is_active)
VALUES ('aplazada', 'Aplazada', 'Tarea que ha sido aplazada para una fecha posterior', '#f59e0b', 4, true)
ON CONFLICT (value) DO NOTHING;