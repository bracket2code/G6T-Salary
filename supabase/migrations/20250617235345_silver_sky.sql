/*
  # Actualizar sistema de usuarios con especialidades

  1. Cambios
    - Actualizar enum de roles de worker
    - Crear tabla de especialidades de usuarios
    - Crear enum para tipos de trabajo
    - Actualizar políticas RLS
    
  2. Nuevas tablas
    - user_skills: Especialidades de cada usuario
    
  3. Nuevos tipos
    - skill_type: Tipos de especialidades disponibles
    - skill_level: Niveles de experiencia
*/

-- Crear enum para tipos de especialidades
CREATE TYPE skill_type AS ENUM (
  'electricidad',
  'electronica', 
  'general',
  'fontaneria',
  'construccion',
  'tecnologia',
  'cerrajeria',
  'cristaleria',
  'limpieza',
  'sonido',
  'luces'
);

-- Crear enum para niveles de especialidad
CREATE TYPE skill_level AS ENUM ('principiante', 'intermedio', 'experto');

-- Crear tabla de especialidades de usuarios
CREATE TABLE IF NOT EXISTS user_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  skill_type skill_type NOT NULL,
  skill_level skill_level NOT NULL DEFAULT 'principiante',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  UNIQUE(user_id, skill_type)
);

-- Habilitar RLS
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para user_skills
CREATE POLICY "Usuarios pueden ver todas las especialidades"
  ON user_skills
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios pueden gestionar sus especialidades"
  ON user_skills
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Crear trigger para updated_at
CREATE TRIGGER update_user_skills_updated_at
  BEFORE UPDATE ON user_skills
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill_type ON user_skills(skill_type);

-- Función para obtener tipos de especialidades
CREATE OR REPLACE FUNCTION get_skill_types()
RETURNS TABLE (value text, label text)
LANGUAGE sql
STABLE
AS $$
  WITH skill_values AS (
    SELECT unnest(enum_range(NULL::skill_type))::text as skill_value
  )
  SELECT 
    skill_value as value,
    CASE skill_value
      WHEN 'electricidad' THEN 'Electricidad'
      WHEN 'electronica' THEN 'Electrónica'
      WHEN 'general' THEN 'General'
      WHEN 'fontaneria' THEN 'Fontanería'
      WHEN 'construccion' THEN 'Construcción'
      WHEN 'tecnologia' THEN 'Tecnología'
      WHEN 'cerrajeria' THEN 'Cerrajería'
      WHEN 'cristaleria' THEN 'Cristalería'
      WHEN 'limpieza' THEN 'Limpieza'
      WHEN 'sonido' THEN 'Sonido'
      WHEN 'luces' THEN 'Luces'
    END as label
  FROM skill_values
  ORDER BY label;
$$;

-- Función para obtener niveles de especialidad
CREATE OR REPLACE FUNCTION get_skill_levels()
RETURNS TABLE (value text, label text)
LANGUAGE sql
STABLE
AS $$
  WITH level_values AS (
    SELECT unnest(enum_range(NULL::skill_level))::text as level_value
  )
  SELECT 
    level_value as value,
    CASE level_value
      WHEN 'principiante' THEN 'Principiante'
      WHEN 'intermedio' THEN 'Intermedio'
      WHEN 'experto' THEN 'Experto'
    END as label
  FROM level_values
  ORDER BY 
    CASE level_value
      WHEN 'principiante' THEN 1
      WHEN 'intermedio' THEN 2
      WHEN 'experto' THEN 3
    END;
$$;

-- Función para obtener usuarios con sus especialidades
CREATE OR REPLACE FUNCTION get_users_with_skills()
RETURNS TABLE (
  user_id uuid,
  user_name text,
  user_email text,
  user_role worker_role,
  user_phone text,
  user_avatar_url text,
  user_created_at timestamptz,
  user_updated_at timestamptz,
  skills jsonb
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    w.id as user_id,
    w.name as user_name,
    w.email as user_email,
    w.role as user_role,
    w.phone as user_phone,
    w.avatar_url as user_avatar_url,
    w.created_at as user_created_at,
    w.updated_at as user_updated_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', us.id,
          'skill_type', us.skill_type,
          'skill_level', us.skill_level,
          'created_at', us.created_at
        )
      ) FILTER (WHERE us.id IS NOT NULL),
      '[]'::jsonb
    ) as skills
  FROM workers w
  LEFT JOIN user_skills us ON w.id = us.user_id
  GROUP BY w.id
  ORDER BY w.name;
$$;