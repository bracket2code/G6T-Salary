/*
  # Fix task conversations RLS policy

  1. Security Updates
    - Update INSERT policy to properly check authenticated user ID
    - Ensure the policy allows users to insert messages where they are the author
    - Fix the policy condition to use auth.uid() correctly

  2. Changes
    - Drop existing INSERT policy that may be incorrectly configured
    - Create new INSERT policy with proper authentication check
*/

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON task_conversations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON task_conversations;

-- Create new INSERT policy that allows authenticated users to insert their own messages
CREATE POLICY "Allow authenticated users to insert their own messages" 
  ON task_conversations 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Ensure the SELECT policy allows viewing all conversations for authenticated users
DROP POLICY IF EXISTS "Authenticated users can view all conversations" ON task_conversations;
CREATE POLICY "Authenticated users can view all conversations"
  ON task_conversations
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure UPDATE policy allows users to update their own messages
DROP POLICY IF EXISTS "Users can update their own conversations" ON task_conversations;
CREATE POLICY "Users can update their own conversations"
  ON task_conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure DELETE policy allows users to delete their own messages
DROP POLICY IF EXISTS "Users can delete their own conversations" ON task_conversations;
CREATE POLICY "Users can delete their own conversations"
  ON task_conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);