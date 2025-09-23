/*
  # Fix task_conversations RLS policies

  1. Security Updates
    - Update INSERT policy to allow users to insert conversations for their worker record
    - Update other policies to work with the workers table relationship
    - Ensure proper access control based on worker-auth user relationship

  2. Changes
    - Drop existing policies that don't work with the current schema
    - Create new policies that properly check worker-auth user relationship
    - Allow authenticated users to insert conversations as their worker record
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON task_conversations;
DROP POLICY IF EXISTS "Authenticated users can view conversations" ON task_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON task_conversations;

-- Create new policies that work with the workers table relationship
CREATE POLICY "Workers can insert their own conversations"
  ON task_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view all conversations"
  ON task_conversations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Workers can delete their own conversations"
  ON task_conversations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  );

CREATE POLICY "Workers can update their own conversations"
  ON task_conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = user_id 
      AND workers.id = auth.uid()
    )
  );