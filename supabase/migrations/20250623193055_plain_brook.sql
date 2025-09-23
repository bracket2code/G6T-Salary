/*
  # Fix task_conversations RLS policies

  1. Security Changes
    - Drop existing RLS policies that reference workers table incorrectly
    - Create new policies that work with Supabase auth system
    - Allow authenticated users to insert their own conversations
    - Allow authenticated users to view all conversations
    - Allow users to update and delete their own conversations

  2. Changes Made
    - Updated INSERT policy to use auth.uid() directly
    - Updated UPDATE policy to use auth.uid() directly  
    - Updated DELETE policy to use auth.uid() directly
    - Kept SELECT policy to allow viewing all conversations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view all conversations" ON task_conversations;
DROP POLICY IF EXISTS "Workers can delete their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Workers can insert their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Workers can update their own conversations" ON task_conversations;

-- Create new policies that work with Supabase auth
CREATE POLICY "Authenticated users can view all conversations"
  ON task_conversations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own conversations"
  ON task_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON task_conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON task_conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);