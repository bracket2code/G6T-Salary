/*
  # Sistema de conversaciones para tareas

  1. Nueva tabla `task_conversations`
    - `id` (uuid, primary key)
    - `task_id` (uuid, foreign key to tasks)
    - `user_id` (uuid, foreign key to workers)
    - `message` (text, contenido del mensaje)
    - `created_at` (timestamp)
    - `updated_at` (timestamp)

  2. Nueva tabla `conversation_attachments`
    - `id` (uuid, primary key)
    - `conversation_id` (uuid, foreign key to task_conversations)
    - `file_name` (text)
    - `file_type` (text, 'audio', 'document', 'image')
    - `file_url` (text)
    - `file_size` (bigint)
    - `duration` (integer, para archivos de audio)
    - `created_at` (timestamp)

  3. Seguridad
    - Habilitar RLS en ambas tablas
    - Políticas para usuarios autenticados
*/

-- Crear tabla de conversaciones
CREATE TABLE IF NOT EXISTS task_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT null
);

-- Crear tabla de archivos adjuntos de conversaciones
CREATE TABLE IF NOT EXISTS conversation_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES task_conversations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('audio', 'document', 'image')),
  file_url text NOT NULL,
  file_size bigint,
  duration integer, -- duración en segundos para archivos de audio
  created_at timestamptz DEFAULT now()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_task_conversations_task_id ON task_conversations(task_id);
CREATE INDEX IF NOT EXISTS idx_task_conversations_user_id ON task_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_task_conversations_created_at ON task_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_attachments_conversation_id ON conversation_attachments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_attachments_file_type ON conversation_attachments(file_type);

-- Habilitar RLS
ALTER TABLE task_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad para task_conversations
CREATE POLICY "Authenticated users can view conversations"
  ON task_conversations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert conversations"
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

-- Políticas de seguridad para conversation_attachments
CREATE POLICY "Authenticated users can view conversation attachments"
  ON conversation_attachments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert conversation attachments"
  ON conversation_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete attachments from their own conversations"
  ON conversation_attachments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_conversations 
      WHERE task_conversations.id = conversation_attachments.conversation_id 
      AND task_conversations.user_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_conversations_updated_at
  BEFORE UPDATE ON task_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();