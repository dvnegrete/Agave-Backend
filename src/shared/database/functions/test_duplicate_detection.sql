-- Script de pruebas para la función de detección de duplicados
-- Ejecutar después de instalar la función y trigger

-- Preparación: Limpiar tablas para pruebas
-- NOTA: Descomentar solo en entorno de pruebas
-- DELETE FROM last_transaction_bank;
-- DELETE FROM transactions_bank;

-- Test 1: Insertar primera transacción (debe permitirse)
DO $$
BEGIN
    RAISE NOTICE 'Test 1: Insertando primera transacción...';

    INSERT INTO transactions_bank (
        date, time, concept, amount, currency, is_deposit, bank_name, validation_flag
    ) VALUES (
        '2024-01-15', '10:30:00', 'Transferencia inicial', 1000.00, 'COP', true, 'Santander', false
    );

    RAISE NOTICE 'Test 1: ✅ Primera transacción insertada correctamente';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 1: ❌ Error al insertar primera transacción: %', SQLERRM;
END $$;

-- Test 2: Insertar transacción duplicada exacta (debe ignorarse silenciosamente)
DO $$
DECLARE
    count_before INTEGER;
    count_after INTEGER;
BEGIN
    RAISE NOTICE 'Test 2: Insertando transacción duplicada exacta...';

    -- Contar registros antes de la inserción
    SELECT COUNT(*) INTO count_before FROM transactions_bank;

    INSERT INTO transactions_bank (
        date, time, concept, amount, currency, is_deposit, bank_name, validation_flag
    ) VALUES (
        '2024-01-15', '10:30:00', 'Transferencia inicial', 1000.00, 'COP', true, 'Santander', false
    );

    -- Contar registros después de la inserción
    SELECT COUNT(*) INTO count_after FROM transactions_bank;

    IF count_after = count_before THEN
        RAISE NOTICE 'Test 2: ✅ Transacción duplicada ignorada correctamente (no se insertó)';
    ELSE
        RAISE NOTICE 'Test 2: ❌ ERROR: Transacción duplicada fue insertada cuando debería ser ignorada';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 2: ❌ Error inesperado al procesar transacción duplicada: %', SQLERRM;
END $$;

-- Test 3: Insertar transacción con diferente monto (debe permitirse)
DO $$
BEGIN
    RAISE NOTICE 'Test 3: Insertando transacción con diferente monto...';

    INSERT INTO transactions_bank (
        date, time, concept, amount, currency, is_deposit, bank_name, validation_flag
    ) VALUES (
        '2024-01-15', '10:30:00', 'Transferencia inicial', 1500.00, 'COP', true, 'Santander', false
    );

    RAISE NOTICE 'Test 3: ✅ Transacción con diferente monto insertada correctamente';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 3: ❌ Error al insertar transacción con diferente monto: %', SQLERRM;
END $$;

-- Test 4: Insertar transacción con diferente banco (debe permitirse)
DO $$
BEGIN
    RAISE NOTICE 'Test 4: Insertando transacción con diferente banco...';

    INSERT INTO transactions_bank (
        date, time, concept, amount, currency, is_deposit, bank_name, validation_flag
    ) VALUES (
        '2024-01-15', '10:30:00', 'Transferencia inicial', 1000.00, 'COP', true, 'Bancolombia', false
    );

    RAISE NOTICE 'Test 4: ✅ Transacción con diferente banco insertada correctamente';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 4: ❌ Error al insertar transacción con diferente banco: %', SQLERRM;
END $$;

-- Test 5: Insertar transacción con fecha posterior (debe permitirse)
DO $$
BEGIN
    RAISE NOTICE 'Test 5: Insertando transacción con fecha posterior...';

    INSERT INTO transactions_bank (
        date, time, concept, amount, currency, is_deposit, bank_name, validation_flag
    ) VALUES (
        '2024-01-16', '11:00:00', 'Nueva transferencia', 2000.00, 'COP', true, 'Santander', false
    );

    RAISE NOTICE 'Test 5: ✅ Transacción con fecha posterior insertada correctamente';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 5: ❌ Error al insertar transacción con fecha posterior: %', SQLERRM;
END $$;

-- Test 6: Insertar múltiples transacciones incluyendo duplicados (prueba de lote)
DO $$
DECLARE
    count_before INTEGER;
    count_after INTEGER;
BEGIN
    RAISE NOTICE 'Test 6: Insertando lote de transacciones con duplicados mezclados...';

    -- Contar registros antes
    SELECT COUNT(*) INTO count_before FROM transactions_bank;

    -- Insertar lote con duplicados y válidas mezcladas
    INSERT INTO transactions_bank (
        date, time, concept, amount, currency, is_deposit, bank_name, validation_flag
    ) VALUES
        ('2024-01-15', '10:30:00', 'Transferencia inicial', 1000.00, 'COP', true, 'Santander', false), -- Duplicado (debe ignorarse)
        ('2024-01-16', '14:20:00', 'Pago servicios', 500.00, 'COP', false, 'Santander', false), -- Válida
        ('2024-01-15', '10:30:00', 'Transferencia inicial', 1500.00, 'COP', true, 'Santander', false), -- Válida (diferente monto)
        ('2024-01-16', '14:20:00', 'Pago servicios', 500.00, 'COP', false, 'Santander', false), -- Duplicado (debe ignorarse)
        ('2024-01-17', '09:15:00', 'Depósito', 2000.00, 'COP', true, 'Santander', false); -- Válida

    -- Contar registros después
    SELECT COUNT(*) INTO count_after FROM transactions_bank;

    RAISE NOTICE 'Test 6: Registros antes: %, después: %, insertados: %', count_before, count_after, (count_after - count_before);
    RAISE NOTICE 'Test 6: ✅ Lote procesado - duplicados ignorados, válidas insertadas';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Test 6: ❌ Error al procesar lote de transacciones: %', SQLERRM;
END $$;

-- Mostrar resultados finales de las pruebas
DO $$
DECLARE
    total_count INTEGER;
    unique_dates INTEGER;
    unique_banks INTEGER;
    unique_amounts INTEGER;
    transaction_summary TEXT;
BEGIN
    SELECT COUNT(*) INTO total_count FROM transactions_bank;
    SELECT COUNT(DISTINCT date) INTO unique_dates FROM transactions_bank;
    SELECT COUNT(DISTINCT bank_name) INTO unique_banks FROM transactions_bank;
    SELECT COUNT(DISTINCT amount) INTO unique_amounts FROM transactions_bank;

    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMEN DE RESULTADOS DE PRUEBAS:';
    RAISE NOTICE '- Total transacciones insertadas: %', total_count;
    RAISE NOTICE '- Fechas diferentes: %', unique_dates;
    RAISE NOTICE '- Bancos diferentes: %', unique_banks;
    RAISE NOTICE '- Montos diferentes: %', unique_amounts;

    -- Mostrar todas las transacciones insertadas
    RAISE NOTICE '';
    RAISE NOTICE '📋 TRANSACCIONES EN BD:';
    FOR transaction_summary IN
        SELECT format('- %s %s: %s ($%s) [%s]', date, time, concept, amount, bank_name)
        FROM transactions_bank
        ORDER BY date, time
    LOOP
        RAISE NOTICE '%', transaction_summary;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Pruebas de detección de duplicados completadas exitosamente';
END $$;