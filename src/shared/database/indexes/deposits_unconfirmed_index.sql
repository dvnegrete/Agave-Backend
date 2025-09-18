-- Índice parcial para transacciones de depósitos no confirmados
-- Optimiza consultas frecuentes de depósitos pendientes de confirmación

-- Eliminar el índice si existe (para reinstalaciones)
DROP INDEX IF EXISTS idx_transactions_bank_deposits_unconfirmed;

-- Crear índice parcial para depósitos no confirmados
CREATE INDEX idx_transactions_bank_deposits_unconfirmed
ON transactions_bank (is_deposit, confirmation_status)
WHERE is_deposit = true AND confirmation_status = false;

-- Información del índice
COMMENT ON INDEX idx_transactions_bank_deposits_unconfirmed IS
'Índice parcial para optimizar consultas de depósitos no confirmados.
Solo indexa registros donde is_deposit=true AND confirmation_status=false.
Optimiza consultas del tipo: SELECT * FROM transactions_bank WHERE is_deposit = true AND confirmation_status = false;';

-- Mostrar información del índice creado
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname = 'idx_transactions_bank_deposits_unconfirmed';

-- Mostrar estadísticas del índice (ejecutar después de que haya datos)
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     idx_tup_read,
--     idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE indexname = 'idx_transactions_bank_deposits_unconfirmed';