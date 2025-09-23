/*
  # Fix task_conversations RLS policies

  1. Security Updates
    - Update INSERT policy to properly check authenticated users
    - Ensure policies work with the current authentication system
    - Maintain security while allowing proper functionality

  2. Changes
    - Drop existing INSERT policy that's causing issues
    - Create new INSERT policy that checks auth.uid() directly
    - Ensure consistency with other table policies
*/

-- Drop the existing problematic INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON task_conversations;

-- Create a new INSERT policy that properly handles authentication
CREATE POLICY "Authenticated users can insert conversations"
  ON task_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid()
  );

-- Also update the UPDATE policy to be consistent
DROP POLICY IF EXISTS "Users can update their own conversations" ON task_conversations;

CREATE POLICY "Users can update their own conversations"
  ON task_conversations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Update the DELETE policy to be consistent
DROP POLICY IF EXISTS "Users can delete their own conversations" ON task_conversations;

CREATE POLICY "Users can delete their own conversations"
  ON task_conversations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());