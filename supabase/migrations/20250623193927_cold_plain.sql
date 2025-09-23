/*
  # Fix RLS policies for task conversations

  1. Security Updates
    - Update RLS policies for `task_conversations` table to work with workers table
    - Update RLS policies for `conversation_attachments` table to work with workers table
    - Ensure authenticated users can insert/update/delete their own conversations and attachments

  2. Changes Made
    - Modified INSERT policy to allow authenticated users to insert conversations
    - Modified UPDATE policy to allow users to update their own conversations  
    - Modified DELETE policy to allow users to delete their own conversations
    - Updated conversation_attachments policies to work with the worker system
*/

-- Drop existing policies for task_conversations
DROP POLICY IF EXISTS "Allow authenticated users to insert their own messages" ON task_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON task_conversations;

-- Create new policies for task_conversations that work with workers table
CREATE POLICY "Authenticated users can insert conversations"
  ON task_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = task_conversations.user_id 
      AND workers.id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own conversations"
  ON task_conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = task_conversations.user_id 
      AND workers.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = task_conversations.user_id 
      AND workers.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own conversations"
  ON task_conversations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = task_conversations.user_id 
      AND workers.id = auth.uid()
    )
  );

-- Update conversation_attachments policies to work with workers table
DROP POLICY IF EXISTS "Users can delete attachments from their own conversations" ON conversation_attachments;

CREATE POLICY "Users can delete attachments from their own conversations"
  ON conversation_attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_conversations tc
      JOIN workers w ON w.id = tc.user_id
      WHERE tc.id = conversation_attachments.conversation_id 
      AND w.id = auth.uid()
    )
  );