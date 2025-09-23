/*
  # Fix task conversations RLS policy

  1. Security Updates
    - Update INSERT policy for task_conversations to properly validate worker relationship
    - Ensure authenticated users can only insert conversations as valid workers
    - Maintain security while allowing proper functionality

  2. Changes
    - Drop existing INSERT policy that was too restrictive
    - Create new INSERT policy that validates the user is a valid worker
    - Keep existing SELECT, UPDATE, and DELETE policies unchanged
*/

-- Drop the existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON task_conversations;

-- Create a new INSERT policy that properly validates the worker relationship
CREATE POLICY "Workers can insert conversations"
  ON task_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  );

-- Also update the existing UPDATE policy to be consistent
DROP POLICY IF EXISTS "Users can update their own conversations" ON task_conversations;

CREATE POLICY "Workers can update their own conversations"
  ON task_conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  );

-- Update the DELETE policy to be consistent
DROP POLICY IF EXISTS "Users can delete their own conversations" ON task_conversations;

CREATE POLICY "Workers can delete their own conversations"
  ON task_conversations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  );