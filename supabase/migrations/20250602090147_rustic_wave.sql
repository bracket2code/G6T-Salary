/*
  # Add sample maintenance tasks

  1. Changes
    - Insert sample tasks with realistic maintenance scenarios
    - Tasks include various priorities and locations
    - All tasks have proper start and end dates

  2. Data
    - 10 sample tasks covering different maintenance scenarios
    - Distributed across different locations
    - Mix of priorities (low, medium, high, critical)
*/

-- Insert sample tasks
INSERT INTO tasks (
  title,
  description,
  location_id,
  priority,
  start_date,
  end_date
) VALUES
  (
    'Mantenimiento Sistema Eléctrico',
    'Revisión y mantenimiento del sistema eléctrico principal, incluye tableros y conexiones.',
    (SELECT id FROM locations WHERE name = 'Oficina Central'),
    'high',
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day 4 hours'
  ),
  (
    'Reparación Aire Acondicionado',
    'Falla en sistema de aire acondicionado en área de oficinas. Requiere revisión urgente.',
    (SELECT id FROM locations WHERE name = 'Oficina Central'),
    'critical',
    NOW() + INTERVAL '3 hours',
    NOW() + INTERVAL '6 hours'
  ),
  (
    'Inspección de Montacargas',
    'Mantenimiento preventivo de montacargas #2, incluye revisión de sistema hidráulico.',
    (SELECT id FROM locations WHERE name = 'Almacén Principal'),
    'medium',
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days 3 hours'
  ),
  (
    'Limpieza de Filtros',
    'Limpieza programada de filtros de ventilación en área de producción.',
    (SELECT id FROM locations WHERE name = 'Planta de Producción'),
    'low',
    NOW() + INTERVAL '5 days',
    NOW() + INTERVAL '5 days 2 hours'
  ),
  (
    'Reparación Puerta Automática',
    'La puerta principal del centro de distribución no cierra correctamente.',
    (SELECT id FROM locations WHERE name = 'Centro de Distribución'),
    'high',
    NOW() + INTERVAL '1 day 2 hours',
    NOW() + INTERVAL '1 day 4 hours'
  ),
  (
    'Mantenimiento Sistema Contra Incendios',
    'Revisión trimestral del sistema contra incendios y rociadores.',
    (SELECT id FROM locations WHERE name = 'Planta de Producción'),
    'high',
    NOW() + INTERVAL '3 days',
    NOW() + INTERVAL '3 days 6 hours'
  ),
  (
    'Calibración Básculas',
    'Calibración programada de básculas de carga.',
    (SELECT id FROM locations WHERE name = 'Centro de Distribución'),
    'medium',
    NOW() + INTERVAL '4 days',
    NOW() + INTERVAL '4 days 2 hours'
  ),
  (
    'Reparación Iluminación',
    'Reemplazo de luminarias defectuosas en área de almacenamiento.',
    (SELECT id FROM locations WHERE name = 'Almacén Principal'),
    'low',
    NOW() + INTERVAL '6 days',
    NOW() + INTERVAL '6 days 3 hours'
  ),
  (
    'Mantenimiento Compresores',
    'Mantenimiento preventivo de sistema de aire comprimido.',
    (SELECT id FROM locations WHERE name = 'Planta de Producción'),
    'medium',
    NOW() + INTERVAL '7 days',
    NOW() + INTERVAL '7 days 4 hours'
  ),
  (
    'Inspección Sistema Plomería',
    'Revisión de tuberías y sistema de drenaje por reportes de fugas.',
    (SELECT id FROM locations WHERE name = 'Oficina Central'),
    'high',
    NOW() + INTERVAL '2 days 3 hours',
    NOW() + INTERVAL '2 days 6 hours'
  );