/*
  # Arreglar sistema completo de archivos y conversaciones

  1. Arreglar bucket de storage
    - Actualizar bucket con configuración correcta
    - Arreglar políticas de storage

  2. Arreglar políticas RLS
    - Simplificar políticas de task_conversations
    - Simplificar políticas de conversation_attachments
    - Simplificar políticas de task_attachments

  3. Asegurar que todo funcione
    - Verificar que los usuarios puedan subir archivos
    - Verificar que los usuarios puedan escribir conversaciones
    - Verificar que los usuarios puedan ver y descargar archivos
*/

-- 1. ACTUALIZAR BUCKET DE STORAGE (SIN ELIMINAR)
-- Actualizar bucket existente o crear uno nuevo
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  true, -- Público para facilitar acceso
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

-- 2. ELIMINAR TODAS LAS POLÍTICAS DE STORAGE EXISTENTES
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
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar errores si la política no existe
    END;
  END LOOP;
END $$;

-- 3. CREAR POLÍTICAS DE STORAGE SIMPLES Y FUNCIONALES
-- Permitir a usuarios autenticados subir archivos
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

-- Permitir acceso público de lectura
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

-- Permitir a usuarios autenticados eliminar cualquier archivo
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

-- Permitir a usuarios autenticados actualizar cualquier archivo
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

-- 4. ARREGLAR POLÍTICAS RLS DE TASK_CONVERSATIONS
-- Eliminar políticas existentes de forma segura
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
    'Workers can insert conversations'
  ];
BEGIN
  FOREACH policy_name IN ARRAY policy_names
  LOOP
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON task_conversations', policy_name);
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar errores si la política no existe
    END;
  END LOOP;
END $$;

-- Crear políticas simples que funcionen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'task_conversations' 
    AND policyname = 'Allow all conversation operations'
  ) THEN
    CREATE POLICY "Allow all conversation operations"
    ON task_conversations FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. ARREGLAR POLÍTICAS RLS DE CONVERSATION_ATTACHMENTS
-- Eliminar políticas existentes de forma segura
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
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON conversation_attachments', policy_name);
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar errores si la política no existe
    END;
  END LOOP;
END $$;

-- Crear políticas simples que funcionen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'conversation_attachments' 
    AND policyname = 'Allow all conversation attachment operations'
  ) THEN
    CREATE POLICY "Allow all conversation attachment operations"
    ON conversation_attachments FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. ARREGLAR POLÍTICAS RLS DE TASK_ATTACHMENTS
-- Eliminar políticas existentes de forma segura
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
    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS %I ON task_attachments', policy_name);
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar errores si la política no existe
    END;
  END LOOP;
END $$;

-- Crear políticas simples que funcionen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'task_attachments' 
    AND policyname = 'Allow all task attachment operations'
  ) THEN
    CREATE POLICY "Allow all task attachment operations"
    ON task_attachments FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. ASEGURAR QUE RLS ESTÉ HABILITADO
ALTER TABLE task_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- 8. CREAR FUNCIÓN PARA VERIFICAR CONFIGURACIÓN
CREATE OR REPLACE FUNCTION verify_storage_setup()
RETURNS TABLE (
  component text,
  status text,
  details text
) AS $$
BEGIN
  -- Verificar bucket
  RETURN QUERY
  SELECT 
    'Storage Bucket'::text,
    CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'task-attachments') 
         THEN 'OK' ELSE 'ERROR' END::text,
    'Bucket task-attachments'::text;
  
  -- Verificar políticas de storage
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
  
  -- Verificar políticas de conversaciones
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
    
END;
$$ LANGUAGE plpgsql;