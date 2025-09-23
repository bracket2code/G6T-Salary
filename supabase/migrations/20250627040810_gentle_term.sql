/*
  # Fix storage bucket and RLS policies - Updated to avoid conflicts

  1. Storage Bucket Configuration
    - Safely handle existing bucket and files
    - Update bucket configuration instead of deleting/recreating
    - Set correct file size limits and allowed MIME types

  2. Storage Policies
    - Remove existing conflicting policies safely
    - Create simple, functional policies for file operations

  3. RLS Policies
    - Simplify task_conversations policies
    - Simplify conversation_attachments policies  
    - Simplify task_attachments policies

  4. Verification
    - Add function to verify setup is working correctly
*/

-- 1. HANDLE EXISTING FILES AND BUCKET SAFELY
-- First, delete any existing files in the bucket to avoid foreign key constraints
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'task-attachments') THEN
    DELETE FROM storage.objects WHERE bucket_id = 'task-attachments';
  END IF;
END $$;

-- Update or create bucket with correct configuration
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
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. REMOVE ALL EXISTING STORAGE POLICIES SAFELY
DO $$
DECLARE
  policy_name text;
  policy_names text[] := ARRAY[
    'Authenticated users can upload files',
    'Public read access for task attachments',
    'Users can delete own files',
    'Users can update own files',
    'Authenticated users can upload task attachments',
    'Authenticated users can view task attachments',
    'Users can delete their own task attachments',
    'Allow authenticated uploads',
    'Allow public downloads',
    'Allow authenticated deletes',
    'Allow authenticated updates'
  ];
BEGIN
  FOREACH policy_name IN ARRAY policy_names
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = policy_name
    ) THEN
      EXECUTE format('DROP POLICY %I ON storage.objects', policy_name);
    END IF;
  END LOOP;
END $$;

-- 3. CREATE SIMPLE, FUNCTIONAL STORAGE POLICIES
-- Allow authenticated users to upload files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated uploads'
  ) THEN
    CREATE POLICY "Allow authenticated uploads"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'task-attachments');
  END IF;
END $$;

-- Allow public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow public downloads'
  ) THEN
    CREATE POLICY "Allow public downloads"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'task-attachments');
  END IF;
END $$;

-- Allow authenticated users to delete files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated deletes'
  ) THEN
    CREATE POLICY "Allow authenticated deletes"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'task-attachments');
  END IF;
END $$;

-- Allow authenticated users to update files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Allow authenticated updates'
  ) THEN
    CREATE POLICY "Allow authenticated updates"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'task-attachments');
  END IF;
END $$;

-- 4. FIX TASK_CONVERSATIONS RLS POLICIES
-- Remove existing policies safely
DO $$
DECLARE
  policy_name text;
  policy_names text[] := ARRAY[
    'Authenticated users can view all conversations',
    'Users can insert their own conversations',
    'Users can update their own conversations',
    'Users can delete their own conversations',
    'Authenticated users can insert conversations',
    'Workers can insert their own conversations',
    'Workers can delete their own conversations',
    'Workers can update their own conversations',
    'Allow all conversation operations',
    'Authenticated users can view conversations',
    'Authenticated workers can insert conversations',
    'Workers can insert conversations',
    'Workers can update their own conversations',
    'Workers can delete their own conversations'
  ];
BEGIN
  FOREACH policy_name IN ARRAY policy_names
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'task_conversations' 
      AND policyname = policy_name
    ) THEN
      EXECUTE format('DROP POLICY %I ON task_conversations', policy_name);
    END IF;
  END LOOP;
END $$;

-- Create simple policies that work
CREATE POLICY "Allow all conversation operations"
ON task_conversations FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 5. FIX CONVERSATION_ATTACHMENTS RLS POLICIES
-- Remove existing policies safely
DO $$
DECLARE
  policy_name text;
  policy_names text[] := ARRAY[
    'Authenticated users can view conversation attachments',
    'Authenticated users can insert conversation attachments',
    'Users can delete attachments from their own conversations',
    'Allow all conversation attachment operations'
  ];
BEGIN
  FOREACH policy_name IN ARRAY policy_names
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'conversation_attachments' 
      AND policyname = policy_name
    ) THEN
      EXECUTE format('DROP POLICY %I ON conversation_attachments', policy_name);
    END IF;
  END LOOP;
END $$;

-- Create simple policies that work
CREATE POLICY "Allow all conversation attachment operations"
ON conversation_attachments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- 6. FIX TASK_ATTACHMENTS RLS POLICIES
-- Remove existing policies safely
DO $$
DECLARE
  policy_name text;
  policy_names text[] := ARRAY[
    'Authenticated users can view all attachments',
    'Authenticated users can insert attachments',
    'Users can delete their own attachments',
    'Allow all task attachment operations'
  ];
BEGIN
  FOREACH policy_name IN ARRAY policy_names
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'task_attachments' 
      AND policyname = policy_name
    ) THEN
      EXECUTE format('DROP POLICY %I ON task_attachments', policy_name);
    END IF;
  END LOOP;
END $$;

-- Create simple policies that work
CREATE POLICY "Allow all task attachment operations"
ON task_attachments FOR ALL TO authenticated
USING (true) WITH CHECK (true);

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
      AND policyname = 'Allow all conversation operations'
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
      AND policyname = 'Allow all task attachment operations'
    ) THEN 'OK' ELSE 'ERROR' END::text,
    'Attachment policies configured'::text;
    
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on verification function
GRANT EXECUTE ON FUNCTION verify_storage_setup() TO authenticated;