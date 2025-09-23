/*
  # Fix task conversations RLS policy

  1. Security Changes
    - Update INSERT policy for task_conversations to properly check worker authentication
    - Ensure the policy correctly validates that the authenticated user exists as a worker
    - Add better error handling for the RLS policy

  The current policy is failing because it's not properly matching the authenticated user
  with their worker record. This migration fixes the policy to ensure proper authentication.
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Workers can insert conversations" ON task_conversations;

-- Create a new, more robust INSERT policy
CREATE POLICY "Authenticated workers can insert conversations"
  ON task_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = auth.uid()
      AND workers.id = task_conversations.user_id
    )
  );

-- Also ensure the SELECT policy is working correctly
DROP POLICY IF EXISTS "Authenticated users can view all conversations" ON task_conversations;

CREATE POLICY "Authenticated users can view conversations"
  ON task_conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = auth.uid()
    )
  );

-- Update the UPDATE policy as well for consistency
DROP POLICY IF EXISTS "Workers can update their own conversations" ON task_conversations;

CREATE POLICY "Workers can update their own conversations"
  ON task_conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = auth.uid()
      AND workers.id = task_conversations.user_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = auth.uid()
      AND workers.id = task_conversations.user_id
    )
  );

-- Update the DELETE policy for consistency
DROP POLICY IF EXISTS "Workers can delete their own conversations" ON task_conversations;

CREATE POLICY "Workers can delete their own conversations"
  ON task_conversations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM workers 
      WHERE workers.id = auth.uid()
      AND workers.id = task_conversations.user_id
    )
  );