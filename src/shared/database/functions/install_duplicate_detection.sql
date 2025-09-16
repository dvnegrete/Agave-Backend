-- Script para instalar la función y trigger de detección de duplicados
-- Ejecutar este script para aplicar la funcionalidad a la base de datos

-- 1. Cargar la función y trigger
\i duplicate_detection.sql

-- 2. Verificar que la función fue creada correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'check_transaction_duplicate'
    ) THEN
        RAISE NOTICE 'Función check_transaction_duplicate creada exitosamente';
    ELSE
        RAISE EXCEPTION 'Error: La función check_transaction_duplicate no fue creada';
    END IF;
END $$;

-- 3. Verificar que el trigger fue creado correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'trigger_check_transaction_duplicate'
    ) THEN
        RAISE NOTICE 'Trigger trigger_check_transaction_duplicate creado exitosamente';
    ELSE
        RAISE EXCEPTION 'Error: El trigger trigger_check_transaction_duplicate no fue creado';
    END IF;
END $$;

-- 4. Mostrar información del trigger
SELECT
    t.tgname AS trigger_name,
    c.relname AS table_name,
    p.proname AS function_name,
    CASE t.tgtype & 66
        WHEN 2 THEN 'BEFORE'
        WHEN 64 THEN 'INSTEAD OF'
        ELSE 'AFTER'
    END AS trigger_timing,
    CASE t.tgtype & 28
        WHEN 4 THEN 'INSERT'
        WHEN 8 THEN 'DELETE'
        WHEN 16 THEN 'UPDATE'
        WHEN 12 THEN 'INSERT, DELETE'
        WHEN 20 THEN 'INSERT, UPDATE'
        WHEN 24 THEN 'DELETE, UPDATE'
        WHEN 28 THEN 'INSERT, DELETE, UPDATE'
    END AS trigger_events
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'trigger_check_transaction_duplicate';

RAISE NOTICE 'Instalación de detección de duplicados completada exitosamente';