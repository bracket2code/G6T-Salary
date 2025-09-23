/*
  # Configuración del bucket de almacenamiento para archivos adjuntos

  1. Bucket de almacenamiento
    - Crear bucket `task-attachments` para archivos de tareas
    - Configurar como público para permitir acceso a archivos

  2. Políticas de seguridad
    - Permitir inserción de archivos para usuarios autenticados
    - Permitir lectura pública de archivos
    - Permitir eliminación solo del propietario del archivo

  3. Configuración
    - Bucket público para facilitar acceso a archivos
    - Límites de tamaño apropiados
*/

-- Crear el bucket de almacenamiento si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime', 'audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg'];

-- Política para permitir inserción de archivos (usuarios autenticados)
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Política para permitir lectura pública de archivos
CREATE POLICY "Public read access for task attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

-- Política para permitir eliminación solo del propietario
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política para permitir actualización solo del propietario
CREATE POLICY "Users can update own files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);