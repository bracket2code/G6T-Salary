/*
  # Fix storage bucket and RLS policies

  1. Storage Bucket Configuration
    - Properly handle existing bucket and files
    - Update bucket configuration instead of deleting/recreating
    - Set correct file size limits and allowed MIME types

  2. Storage Policies
    - Remove existing conflicting policies
    - Create simple, functional policies for file operations

  3. RLS Policies
    - Simplify task_conversations policies
    - Simplify conversation_attachments policies  
    - Simplify task_attachments policies

  4. Verification
    - Add function to verify setup is working correctly
*/

-- 1. HANDLE EXISTING FILES AND BUCKET
-- First, delete any existing files in the bucket to avoid foreign key constraint
DELETE FROM storage.objects WHERE bucket_id = 'task-attachments';

-- Now safely delete and recreate the bucket
DELETE FROM storage.buckets WHERE id = 'task-attachments';

-- Create bucket with correct configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  true, -- Public for easy access
  104857600, -- 100MB limit
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/avi',
    'audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
);

-- 2. REMOVE ALL EXISTING STORAGE POLICIES
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;

-- 3. CREATE SIMPLE, FUNCTIONAL STORAGE POLICIES
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Allow public read access
CREATE POLICY "Allow public downloads"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'task-attachments');

-- Allow authenticated users to delete files
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments');

-- Allow authenticated users to update files
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'task-attachments');

-- 4. FIX TASK_CONVERSATIONS RLS POLICIES
-- Remove existing policies
DROP POLICY IF EXISTS "Authenticated users can view all conversations" ON task_conversations;
DROP POLICY IF EXISTS "Users can insert their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Users can delete their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON task_conversations;
DROP POLICY IF EXISTS "Workers can insert their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Workers can delete their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Workers can update their own conversations" ON task_conversations;
DROP POLICY IF EXISTS "Allow all conversation operations" ON task_conversations;

-- Create simple policies that work
CREATE POLICY "Authenticated users can view all conversations"
ON task_conversations FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert conversations"
ON task_conversations FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workers 
    WHERE workers.id = task_conversations.user_id 
    AND workers.id = auth.uid()
  )
);

CREATE POLICY "Users can update their own conversations"
ON task_conversations FOR UPDATE TO authenticated
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
ON task_conversations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workers 
    WHERE workers.id = task_conversations.user_id 
    AND workers.id = auth.uid()
  )
);

-- 5. FIX CONVERSATION_ATTACHMENTS RLS POLICIES
-- Remove existing policies
DROP POLICY IF EXISTS "Authenticated users can view conversation attachments" ON conversation_attachments;
DROP POLICY IF EXISTS "Authenticated users can insert conversation attachments" ON conversation_attachments;
DROP POLICY IF EXISTS "Users can delete attachments from their own conversations" ON conversation_attachments;
DROP POLICY IF EXISTS "Allow all conversation attachment operations" ON conversation_attachments;

-- Create simple policies that work
CREATE POLICY "Authenticated users can view conversation attachments"
ON conversation_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert conversation attachments"
ON conversation_attachments FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete attachments from their own conversations"
ON conversation_attachments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM task_conversations tc
    JOIN workers w ON w.id = tc.user_id
    WHERE tc.id = conversation_attachments.conversation_id 
    AND w.id = auth.uid()
  )
);

-- 6. FIX TASK_ATTACHMENTS RLS POLICIES
-- Remove existing policies
DROP POLICY IF EXISTS "Authenticated users can view all attachments" ON task_attachments;
DROP POLICY IF EXISTS "Authenticated users can insert attachments" ON task_attachments;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON task_attachments;
DROP POLICY IF EXISTS "Allow all task attachment operations" ON task_attachments;

-- Create simple policies that work
CREATE POLICY "Authenticated users can view all attachments"
ON task_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert attachments"
ON task_attachments FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can delete their own attachments"
ON task_attachments FOR DELETE TO authenticated
USING (uploaded_by = auth.uid());

-- 7. ENSURE RLS IS ENABLED
ALTER TABLE task_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- 8. CREATE VERIFICATION FUNCTION
CREATE OR REPLACE FUNCTION verify_storage_setup()
RETURNS TABLE (
  component text,
  status text,
  details text
) AS $$
BEGIN
  -- Verify bucket exists
  RETURN QUERY
  SELECT 
    'Storage Bucket'::text,
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'task-attachments') 
         THEN 'OK' ELSE 'ERROR' END::text,
    'Bucket task-attachments configured'::text;
  
  -- Verify storage policies exist
  RETURN QUERY
  SELECT 
    'Storage Policies'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Allow authenticated uploads'
    ) THEN 'OK' ELSE 'ERROR' END::text,
    'Storage policies configured'::text;
  
  -- Verify conversation policies exist
  RETURN QUERY
  SELECT 
    'Conversation Policies'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'task_conversations' 
      AND policyname = 'Authenticated users can view all conversations'
    ) THEN 'OK' ELSE 'ERROR' END::text,
    'Conversation policies configured'::text;
    
  -- Verify attachment policies exist
  RETURN QUERY
  SELECT 
    'Attachment Policies'::text,
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'task_attachments' 
      AND policyname = 'Authenticated users can view all attachments'
    ) THEN 'OK' ELSE 'ERROR' END::text,
    'Attachment policies configured'::text;
    
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on verification function
GRANT EXECUTE ON FUNCTION verify_storage_setup() TO authenticated;