/*
  # Traducir estados y roles del sistema

  1. Cambios
    - Traducir estados de tareas (pending -> pendiente, etc)
    - Traducir prioridades (low -> baja, etc)
    - Traducir roles (technician -> tecnico, etc)
    
  2. Proceso
    - Crear nuevos tipos enum
    - Actualizar datos existentes
    - Actualizar columnas y valores por defecto
*/

-- Crear nuevos tipos enum
CREATE TYPE task_status_new AS ENUM ('pendiente', 'en_progreso', 'completada', 'cancelada');
CREATE TYPE task_priority_new AS ENUM ('baja', 'media', 'alta', 'critica');
CREATE TYPE worker_role_new AS ENUM ('admin', 'supervisor', 'tecnico');

-- Actualizar la tabla tasks con los nuevos estados
ALTER TABLE tasks 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN priority DROP DEFAULT;

ALTER TABLE tasks 
  ALTER COLUMN status TYPE task_status_new 
  USING (
    CASE status::text
      WHEN 'pending' THEN 'pendiente'
      WHEN 'in_progress' THEN 'en_progreso'
      WHEN 'completed' THEN 'completada'
      WHEN 'cancelled' THEN 'cancelada'
    END::task_status_new
  ),
  ALTER COLUMN priority TYPE task_priority_new
  USING (
    CASE priority::text
      WHEN 'low' THEN 'baja'
      WHEN 'medium' THEN 'media'
      WHEN 'high' THEN 'alta'
      WHEN 'critical' THEN 'critica'
    END::task_priority_new
  );

-- Actualizar la tabla workers
ALTER TABLE workers ALTER COLUMN role DROP DEFAULT;

ALTER TABLE workers
  ALTER COLUMN role TYPE worker_role_new
  USING (
    CASE role::text
      WHEN 'admin' THEN 'admin'
      WHEN 'manager' THEN 'supervisor'
      WHEN 'technician' THEN 'tecnico'
    END::worker_role_new
  );

-- Eliminar los tipos enum antiguos
DROP TYPE task_status;
DROP TYPE task_priority;
DROP TYPE worker_role;

-- Renombrar los nuevos tipos
ALTER TYPE task_status_new RENAME TO task_status;
ALTER TYPE task_priority_new RENAME TO task_priority;
ALTER TYPE worker_role_new RENAME TO worker_role;

-- Establecer los nuevos valores por defecto
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'pendiente'::task_status;
ALTER TABLE tasks ALTER COLUMN priority SET DEFAULT 'media'::task_priority;
ALTER TABLE workers ALTER COLUMN role SET DEFAULT 'tecnico'::worker_role;