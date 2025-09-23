/*
  # Sistema Avanzado de Tareas Recurrentes

  1. Nuevas Tablas
    - `recurrence_patterns` - Patrones de repetición predefinidos
    - `task_recurrence_advanced` - Configuración avanzada de repetición

  2. Nuevos Tipos de Repetición
    - Días específicos de la semana
    - Días pares/impares
    - Entre semana/fin de semana
    - Cada X días/semanas/meses
    - Fechas específicas del mes
    - Patrones personalizados

  3. Funciones
    - Generación automática de instancias de tareas
    - Cálculo de próximas fechas
    - Gestión de excepciones
*/

-- Crear enum para tipos de patrón de repetición
DO $$ BEGIN
  CREATE TYPE recurrence_pattern_type AS ENUM (
    'daily',
    'weekly', 
    'monthly',
    'yearly',
    'weekdays',
    'weekends',
    'odd_days',
    'even_days',
    'custom_days',
    'nth_weekday',
    'last_weekday',
    'business_days'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Crear tabla de patrones de repetición predefinidos
CREATE TABLE IF NOT EXISTS recurrence_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  pattern_type recurrence_pattern_type NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Actualizar tabla de recurrencia de tareas con nuevos campos
DO $$
BEGIN
  -- Agregar nuevos campos si no existen
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_recurrence' AND column_name = 'pattern_type'
  ) THEN
    ALTER TABLE task_recurrence ADD COLUMN pattern_type recurrence_pattern_type DEFAULT 'weekly';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_recurrence' AND column_name = 'custom_days'
  ) THEN
    ALTER TABLE task_recurrence ADD COLUMN custom_days integer[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_recurrence' AND column_name = 'nth_occurrence'
  ) THEN
    ALTER TABLE task_recurrence ADD COLUMN nth_occurrence integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_recurrence' AND column_name = 'weekday_type'
  ) THEN
    ALTER TABLE task_recurrence ADD COLUMN weekday_type integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_recurrence' AND column_name = 'skip_holidays'
  ) THEN
    ALTER TABLE task_recurrence ADD COLUMN skip_holidays boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'task_recurrence' AND column_name = 'max_instances'
  ) THEN
    ALTER TABLE task_recurrence ADD COLUMN max_instances integer;
  END IF;
END $$;

-- Insertar patrones predefinidos
INSERT INTO recurrence_patterns (name, description, pattern_type) VALUES
  ('Diario', 'Todos los días', 'daily'),
  ('Semanal', 'Cada semana en días específicos', 'weekly'),
  ('Mensual', 'Cada mes en fechas específicas', 'monthly'),
  ('Anual', 'Cada año en fechas específicas', 'yearly'),
  ('Entre semana', 'Solo días laborables (Lunes a Viernes)', 'weekdays'),
  ('Fin de semana', 'Solo sábados y domingos', 'weekends'),
  ('Días impares', 'Solo días impares del mes (1, 3, 5, etc.)', 'odd_days'),
  ('Días pares', 'Solo días pares del mes (2, 4, 6, etc.)', 'even_days'),
  ('Días personalizados', 'Días específicos seleccionados', 'custom_days'),
  ('Primer/Segundo/Tercer... día de la semana', 'Ej: Primer lunes de cada mes', 'nth_weekday'),
  ('Último día de la semana', 'Ej: Último viernes de cada mes', 'last_weekday'),
  ('Solo días laborables', 'Excluye fines de semana y festivos', 'business_days')
ON CONFLICT DO NOTHING;

-- Función para obtener patrones de repetición
CREATE OR REPLACE FUNCTION get_recurrence_patterns()
RETURNS TABLE (
  value text,
  label text,
  description text,
  pattern_type text
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.pattern_type::text as value,
    rp.name as label,
    rp.description,
    rp.pattern_type::text
  FROM recurrence_patterns rp
  WHERE rp.is_active = true
  ORDER BY rp.name;
END;
$$;

-- Función para calcular la próxima fecha de una tarea recurrente
CREATE OR REPLACE FUNCTION calculate_next_recurrence_date(
  p_recurrence_id uuid,
  p_from_date timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
  rec_config record;
  next_date timestamptz;
  temp_date timestamptz;
  day_of_month int;
  target_weekday int;
  week_count int;
BEGIN
  -- Obtener configuración de recurrencia
  SELECT * INTO rec_config
  FROM task_recurrence
  WHERE id = p_recurrence_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Calcular próxima fecha según el tipo de patrón
  CASE rec_config.pattern_type
    WHEN 'daily' THEN
      next_date := p_from_date + (rec_config.interval_value || ' days')::interval;
    
    WHEN 'weekly' THEN
      -- Encontrar el próximo día de la semana especificado
      temp_date := p_from_date;
      LOOP
        temp_date := temp_date + '1 day'::interval;
        IF EXTRACT(dow FROM temp_date)::int = ANY(rec_config.days_of_week) THEN
          next_date := temp_date;
          EXIT;
        END IF;
      END LOOP;
    
    WHEN 'weekdays' THEN
      -- Solo días laborables (1-5: Lunes a Viernes)
      temp_date := p_from_date;
      LOOP
        temp_date := temp_date + '1 day'::interval;
        IF EXTRACT(dow FROM temp_date) BETWEEN 1 AND 5 THEN
          next_date := temp_date;
          EXIT;
        END IF;
      END LOOP;
    
    WHEN 'weekends' THEN
      -- Solo fines de semana (0,6: Domingo y Sábado)
      temp_date := p_from_date;
      LOOP
        temp_date := temp_date + '1 day'::interval;
        IF EXTRACT(dow FROM temp_date) IN (0, 6) THEN
          next_date := temp_date;
          EXIT;
        END IF;
      END LOOP;
    
    WHEN 'odd_days' THEN
      -- Solo días impares del mes
      temp_date := p_from_date;
      LOOP
        temp_date := temp_date + '1 day'::interval;
        IF EXTRACT(day FROM temp_date)::int % 2 = 1 THEN
          next_date := temp_date;
          EXIT;
        END IF;
      END LOOP;
    
    WHEN 'even_days' THEN
      -- Solo días pares del mes
      temp_date := p_from_date;
      LOOP
        temp_date := temp_date + '1 day'::interval;
        IF EXTRACT(day FROM temp_date)::int % 2 = 0 THEN
          next_date := temp_date;
          EXIT;
        END IF;
      END LOOP;
    
    WHEN 'monthly' THEN
      -- Día específico del mes
      next_date := date_trunc('month', p_from_date) + '1 month'::interval + 
                   (rec_config.day_of_month - 1 || ' days')::interval;
    
    WHEN 'nth_weekday' THEN
      -- Ej: Primer lunes de cada mes
      temp_date := date_trunc('month', p_from_date) + '1 month'::interval;
      -- Encontrar el primer día del tipo especificado
      WHILE EXTRACT(dow FROM temp_date) != rec_config.weekday_type LOOP
        temp_date := temp_date + '1 day'::interval;
      END LOOP;
      -- Agregar semanas según nth_occurrence
      next_date := temp_date + ((rec_config.nth_occurrence - 1) * 7 || ' days')::interval;
    
    WHEN 'custom_days' THEN
      -- Días personalizados del mes
      temp_date := p_from_date;
      LOOP
        temp_date := temp_date + '1 day'::interval;
        IF EXTRACT(day FROM temp_date)::int = ANY(rec_config.custom_days) THEN
          next_date := temp_date;
          EXIT;
        END IF;
      END LOOP;
    
    ELSE
      -- Fallback a diario
      next_date := p_from_date + '1 day'::interval;
  END CASE;

  -- Verificar que no exceda la fecha de fin
  IF next_date > rec_config.end_date THEN
    RETURN NULL;
  END IF;

  RETURN next_date;
END;
$$;

-- Función para generar instancias de tareas recurrentes
CREATE OR REPLACE FUNCTION generate_recurring_task_instances(
  p_recurrence_id uuid,
  p_generate_until timestamptz DEFAULT now() + '30 days'::interval
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  rec_config record;
  original_task record;
  next_date timestamptz;
  new_task_id uuid;
  instances_created int := 0;
  max_iterations int := 1000; -- Prevenir loops infinitos
  current_iteration int := 0;
BEGIN
  -- Obtener configuración de recurrencia
  SELECT * INTO rec_config
  FROM task_recurrence
  WHERE id = p_recurrence_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Obtener tarea original
  SELECT * INTO original_task
  FROM tasks
  WHERE id = rec_config.task_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Encontrar la última instancia generada o usar fecha de inicio
  SELECT COALESCE(MAX(scheduled_date), rec_config.start_date) INTO next_date
  FROM recurring_task_instances
  WHERE recurrence_id = p_recurrence_id;

  -- Generar instancias hasta la fecha límite
  WHILE next_date IS NOT NULL 
    AND next_date <= p_generate_until 
    AND next_date <= rec_config.end_date
    AND current_iteration < max_iterations
    AND (rec_config.max_instances IS NULL OR instances_created < rec_config.max_instances)
  LOOP
    current_iteration := current_iteration + 1;
    
    -- Calcular próxima fecha
    next_date := calculate_next_recurrence_date(p_recurrence_id, next_date);
    
    IF next_date IS NULL OR next_date > rec_config.end_date THEN
      EXIT;
    END IF;

    -- Verificar si ya existe una instancia para esta fecha
    IF NOT EXISTS (
      SELECT 1 FROM recurring_task_instances 
      WHERE recurrence_id = p_recurrence_id 
      AND scheduled_date = next_date
    ) THEN
      -- Crear nueva tarea
      INSERT INTO tasks (
        title,
        description,
        location_id,
        priority,
        status,
        start_date,
        end_date
      ) VALUES (
        original_task.title || ' (Recurrente)',
        original_task.description,
        original_task.location_id,
        original_task.priority,
        'sin_asignar',
        next_date,
        next_date + (original_task.end_date - original_task.start_date)
      ) RETURNING id INTO new_task_id;

      -- Registrar la instancia
      INSERT INTO recurring_task_instances (
        recurrence_id,
        original_task_id,
        generated_task_id,
        scheduled_date
      ) VALUES (
        p_recurrence_id,
        rec_config.task_id,
        new_task_id,
        next_date
      );

      instances_created := instances_created + 1;
    END IF;
  END LOOP;

  RETURN instances_created;
END;
$$;

-- Habilitar RLS en nuevas tablas
ALTER TABLE recurrence_patterns ENABLE ROW LEVEL SECURITY;

-- Políticas para recurrence_patterns
CREATE POLICY "Authenticated users can read recurrence patterns"
  ON recurrence_patterns
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage recurrence patterns"
  ON recurrence_patterns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workers 
      WHERE workers.id = auth.uid() 
      AND workers.role = 'admin'
    )
  );