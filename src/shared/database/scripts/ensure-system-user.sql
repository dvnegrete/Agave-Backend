-- =====================================================
-- SCRIPT: Asegurar Usuario del Sistema
-- =====================================================
-- Este script verifica y crea el usuario del sistema si no existe
-- Usuario requerido para conciliación bancaria automática
--
-- UUID: 00000000-0000-0000-0000-000000000000
-- Email: sistema@conciliacion.local
--
-- Uso: psql $DATABASE_URL -f src/shared/database/scripts/ensure-system-user.sql
-- =====================================================

DO $$
BEGIN
  -- Verificar si el usuario ya existe
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000000'
  ) THEN
    -- Insertar usuario del sistema
    INSERT INTO users (id, mail, role, status, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      'sistema@conciliacion.local',
      'tenant',
      'active',
      NOW(),
      NOW()
    );

    RAISE NOTICE '✅ Usuario del sistema creado exitosamente';
    RAISE NOTICE '   UUID: 00000000-0000-0000-0000-000000000000';
    RAISE NOTICE '   Email: sistema@conciliacion.local';
  ELSE
    RAISE NOTICE '✓ Usuario del sistema ya existe';
  END IF;
END $$;

-- Verificar que se creó correctamente
SELECT
  id,
  mail,
  role,
  status,
  created_at
FROM users
WHERE id = '00000000-0000-0000-0000-000000000000';
