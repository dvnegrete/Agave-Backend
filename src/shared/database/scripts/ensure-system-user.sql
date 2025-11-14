-- =====================================================
-- ENSURE SYSTEM USER EXISTS
-- =====================================================
-- Description: Verifica y crea el usuario Sistema requerido
--              para la conciliación bancaria automática
-- Usage: npm run db:ensure-system-user
-- =====================================================

-- Crear usuario Sistema si no existe
INSERT INTO users (id, mail, role, status, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  'tenant',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Verificar creación
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✅ Usuario Sistema verificado/creado correctamente'
    ELSE '❌ Error: Usuario Sistema no pudo ser creado'
  END as status,
  id,
  mail,
  role,
  status as user_status,
  created_at
FROM users
WHERE id = '00000000-0000-0000-0000-000000000000';

-- Información adicional
\echo ''
\echo '=================================================='
\echo 'USUARIO SISTEMA PARA CONCILIACIÓN BANCARIA'
\echo '=================================================='
\echo 'UUID: 00000000-0000-0000-0000-000000000000'
\echo 'Email: sistema@conciliacion.local'
\echo ''
\echo 'Este usuario se usa para asignar casas creadas'
\echo 'automáticamente cuando se identifican por centavos'
\echo 'durante el proceso de conciliación bancaria.'
\echo ''
\echo 'Ver documentación completa en:'
\echo 'docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md'
\echo '=================================================='
