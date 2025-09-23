/*
  # Sistema completo de datos externos de usuario

  1. Nuevas Tablas
    - `user_external_data`: Almacena todos los datos del JWT decodificado
    - `user_parameter_relations`: Almacena las relaciones de parámetros del usuario

  2. Seguridad
    - Habilitar RLS en ambas tablas
    - Políticas para que usuarios solo vean sus propios datos

  3. Funciones
    - Función para guardar datos completos del JWT
    - Función para obtener perfil completo del usuario

  4. Índices
    - Índices para mejorar rendimiento de consultas
*/

-- Crear tabla para datos externos completos del usuario
CREATE TABLE IF NOT EXISTS user_external_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  
  -- Datos básicos del JWT
  external_id text,
  type_int integer, -- 'type' es palabra reservada
  parent_id text, -- 'parent' es palabra reservada
  name text,
  is_deleted boolean DEFAULT false, -- 'delete' es palabra reservada
  organization_id text,
  commercial_name text,
  direccion text,
  phone text,
  iban text,
  provider_email text,
  provider_description text,
  description_control_schedule text,
  dni text,
  social_security text,
  birth_date date,
  situation integer,
  subcategory_id text,
  color text,
  tag_id text,
  files jsonb DEFAULT '[]',
  metadata jsonb,
  order_index integer DEFAULT 0, -- 'order' es palabra reservada
  company_id_contract text,
  access_bool boolean DEFAULT false, -- 'access' es palabra reservada
  total_cash_company_stock numeric,
  movement_type text,
  is_category_staff boolean DEFAULT false,
  
  -- Control de sincronización
  last_sync_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  
  UNIQUE(user_id)
);

-- Crear tabla para relaciones de parámetros
CREATE TABLE IF NOT EXISTS user_parameter_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_external_data_id uuid NOT NULL REFERENCES user_external_data(id) ON DELETE CASCADE,
  
  -- Datos de la relación
  external_relation_id text, -- ID de la relación en la API externa
  parameter_id text,
  parameter_relation_id text,
  type_int integer, -- 'type' es palabra reservada
  product_id text,
  amount numeric,
  
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE user_external_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_parameter_relations ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para user_external_data
CREATE POLICY "Users can view their own external data"
  ON user_external_data
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own external data"
  ON user_external_data
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own external data"
  ON user_external_data
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Crear políticas RLS para user_parameter_relations
CREATE POLICY "Users can view their own parameter relations"
  ON user_parameter_relations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_external_data ued 
      WHERE ued.id = user_parameter_relations.user_external_data_id 
      AND ued.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own parameter relations"
  ON user_parameter_relations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_external_data ued 
      WHERE ued.id = user_parameter_relations.user_external_data_id 
      AND ued.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own parameter relations"
  ON user_parameter_relations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_external_data ued 
      WHERE ued.id = user_parameter_relations.user_external_data_id 
      AND ued.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own parameter relations"
  ON user_parameter_relations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_external_data ued 
      WHERE ued.id = user_parameter_relations.user_external_data_id 
      AND ued.user_id = auth.uid()
    )
  );

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_user_external_data_user_id ON user_external_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_external_data_external_id ON user_external_data(external_id);
CREATE INDEX IF NOT EXISTS idx_user_external_data_organization_id ON user_external_data(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_external_data_last_sync ON user_external_data(last_sync_at);

CREATE INDEX IF NOT EXISTS idx_user_parameter_relations_user_data_id ON user_parameter_relations(user_external_data_id);
CREATE INDEX IF NOT EXISTS idx_user_parameter_relations_parameter_id ON user_parameter_relations(parameter_id);
CREATE INDEX IF NOT EXISTS idx_user_parameter_relations_type ON user_parameter_relations(type_int);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_external_data_updated_at
  BEFORE UPDATE ON user_external_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Función para guardar datos completos del JWT
CREATE OR REPLACE FUNCTION save_user_jwt_data(
  p_user_id uuid,
  p_jwt_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  external_data_id uuid;
  relation_record jsonb;
BEGIN
  -- Insertar o actualizar datos externos principales
  INSERT INTO user_external_data (
    user_id,
    external_id,
    type_int,
    parent_id,
    name,
    is_deleted,
    organization_id,
    commercial_name,
    direccion,
    phone,
    iban,
    provider_email,
    provider_description,
    description_control_schedule,
    dni,
    social_security,
    birth_date,
    situation,
    subcategory_id,
    color,
    tag_id,
    files,
    metadata,
    order_index,
    company_id_contract,
    access_bool,
    total_cash_company_stock,
    movement_type,
    is_category_staff,
    last_sync_at
  ) VALUES (
    p_user_id,
    p_jwt_data->>'id',
    (p_jwt_data->>'type')::integer,
    p_jwt_data->>'parent',
    p_jwt_data->>'name',
    (p_jwt_data->>'delete')::boolean,
    p_jwt_data->>'organizationId',
    p_jwt_data->>'commercialName',
    p_jwt_data->>'direccion',
    p_jwt_data->>'phone',
    p_jwt_data->>'iban',
    p_jwt_data->>'providerEmail',
    p_jwt_data->>'providerDescription',
    p_jwt_data->>'descriptionControlSchedule',
    p_jwt_data->>'dni',
    p_jwt_data->>'socialSecurity',
    CASE 
      WHEN p_jwt_data->>'birthDate' IS NOT NULL 
      THEN (p_jwt_data->>'birthDate')::timestamptz::date
      ELSE NULL 
    END,
    (p_jwt_data->>'situation')::integer,
    p_jwt_data->>'subcategoryId',
    p_jwt_data->>'color',
    p_jwt_data->>'tagId',
    p_jwt_data->'files',
    p_jwt_data->'metadata',
    (p_jwt_data->>'order')::integer,
    p_jwt_data->>'companyIdContract',
    (p_jwt_data->>'access')::boolean,
    (p_jwt_data->>'totalCashCompanyStock')::numeric,
    p_jwt_data->>'movementType',
    (p_jwt_data->>'isCategoryStaff')::boolean,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    external_id = EXCLUDED.external_id,
    type_int = EXCLUDED.type_int,
    parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    is_deleted = EXCLUDED.is_deleted,
    organization_id = EXCLUDED.organization_id,
    commercial_name = EXCLUDED.commercial_name,
    direccion = EXCLUDED.direccion,
    phone = EXCLUDED.phone,
    iban = EXCLUDED.iban,
    provider_email = EXCLUDED.provider_email,
    provider_description = EXCLUDED.provider_description,
    description_control_schedule = EXCLUDED.description_control_schedule,
    dni = EXCLUDED.dni,
    social_security = EXCLUDED.social_security,
    birth_date = EXCLUDED.birth_date,
    situation = EXCLUDED.situation,
    subcategory_id = EXCLUDED.subcategory_id,
    color = EXCLUDED.color,
    tag_id = EXCLUDED.tag_id,
    files = EXCLUDED.files,
    metadata = EXCLUDED.metadata,
    order_index = EXCLUDED.order_index,
    company_id_contract = EXCLUDED.company_id_contract,
    access_bool = EXCLUDED.access_bool,
    total_cash_company_stock = EXCLUDED.total_cash_company_stock,
    movement_type = EXCLUDED.movement_type,
    is_category_staff = EXCLUDED.is_category_staff,
    last_sync_at = EXCLUDED.last_sync_at,
    updated_at = now()
  RETURNING id INTO external_data_id;

  -- Eliminar relaciones existentes
  DELETE FROM user_parameter_relations 
  WHERE user_external_data_id = external_data_id;

  -- Insertar nuevas relaciones de parámetros
  IF p_jwt_data->'parameterRelations' IS NOT NULL THEN
    FOR relation_record IN SELECT * FROM jsonb_array_elements(p_jwt_data->'parameterRelations')
    LOOP
      INSERT INTO user_parameter_relations (
        user_external_data_id,
        external_relation_id,
        parameter_id,
        parameter_relation_id,
        type_int,
        product_id,
        amount
      ) VALUES (
        external_data_id,
        relation_record->>'id',
        relation_record->>'parameterId',
        relation_record->>'parameterRelationId',
        (relation_record->>'type')::integer,
        relation_record->>'productId',
        (relation_record->>'amount')::numeric
      );
    END LOOP;
  END IF;

  RETURN external_data_id;
END;
$$;

-- Función para obtener datos completos del usuario
CREATE OR REPLACE FUNCTION get_user_complete_profile(p_user_id uuid)
RETURNS TABLE (
  -- Datos básicos de workers
  id uuid,
  name text,
  email text,
  role worker_role,
  phone text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz,
  
  -- Datos externos completos
  external_id text,
  type_int integer,
  parent_id text,
  external_name text,
  is_deleted boolean,
  organization_id text,
  commercial_name text,
  direccion text,
  external_phone text,
  iban text,
  provider_email text,
  provider_description text,
  description_control_schedule text,
  dni text,
  social_security text,
  birth_date date,
  situation integer,
  subcategory_id text,
  color text,
  tag_id text,
  files jsonb,
  metadata jsonb,
  order_index integer,
  company_id_contract text,
  access_bool boolean,
  total_cash_company_stock numeric,
  movement_type text,
  is_category_staff boolean,
  last_sync_at timestamptz,
  
  -- Relaciones de parámetros
  parameter_relations jsonb,
  
  -- Metadatos
  has_external_data boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    w.id,
    w.name,
    w.email,
    w.role,
    w.phone,
    w.avatar_url,
    w.created_at,
    w.updated_at,
    
    -- Datos externos
    ued.external_id,
    ued.type_int,
    ued.parent_id,
    ued.name as external_name,
    ued.is_deleted,
    ued.organization_id,
    ued.commercial_name,
    ued.direccion,
    ued.phone as external_phone,
    ued.iban,
    ued.provider_email,
    ued.provider_description,
    ued.description_control_schedule,
    ued.dni,
    ued.social_security,
    ued.birth_date,
    ued.situation,
    ued.subcategory_id,
    ued.color,
    ued.tag_id,
    ued.files,
    ued.metadata,
    ued.order_index,
    ued.company_id_contract,
    ued.access_bool,
    ued.total_cash_company_stock,
    ued.movement_type,
    ued.is_category_staff,
    ued.last_sync_at,
    
    -- Relaciones de parámetros como JSON
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', upr.external_relation_id,
            'parameterId', upr.parameter_id,
            'parameterRelationId', upr.parameter_relation_id,
            'type', upr.type_int,
            'productId', upr.product_id,
            'amount', upr.amount
          )
        )
        FROM user_parameter_relations upr
        WHERE upr.user_external_data_id = ued.id
      ),
      '[]'::jsonb
    ) as parameter_relations,
    
    -- Metadatos
    (ued.id IS NOT NULL) as has_external_data
  FROM workers w
  LEFT JOIN user_external_data ued ON w.id = ued.user_id
  WHERE w.id = p_user_id;
$$;

-- Otorgar permisos
GRANT EXECUTE ON FUNCTION save_user_jwt_data(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_complete_profile(uuid) TO authenticated;