-- Función para detectar duplicados en transacciones bancarias
-- Implementa las reglas de negocio para ignorar inserciones duplicadas

CREATE OR REPLACE FUNCTION check_transaction_duplicate()
RETURNS TRIGGER AS $$
DECLARE
    last_transaction_record RECORD;
    existing_duplicate_count INTEGER;
BEGIN
    -- 1. Obtener el último registro de last_transaction_bank
    SELECT
        tb.date,
        tb.time,
        tb.concept,
        tb.amount,
        tb.bank_name
    INTO last_transaction_record
    FROM last_transaction_bank ltb
    JOIN transactions_bank tb ON ltb.transaction_bank_id = tb.id
    ORDER BY ltb.created_at DESC
    LIMIT 1;

    -- Si no hay registro de referencia, permitir la inserción
    IF last_transaction_record IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Verificar si el banco es diferente
    -- Si es diferente, permitir todas las inserciones
    IF NEW.bank_name != last_transaction_record.bank_name THEN
        RETURN NEW;
    END IF;

    -- 3. Verificar si la fecha es anterior al último registro
    -- Si es anterior, ignorar la inserción (retornar NULL)
    IF NEW.date < last_transaction_record.date THEN
        RAISE NOTICE 'Ignorando transacción con fecha anterior al último registro procesado. Fecha del registro: %, Última fecha procesada: %',
            NEW.date, last_transaction_record.date;
        RETURN NULL; -- Ignora la inserción sin error
    END IF;

    -- 4. Si la fecha es posterior, permitir la inserción
    IF NEW.date > last_transaction_record.date THEN
        RETURN NEW;
    END IF;

    -- 5. Si la fecha es igual, hacer comparación profunda
    -- Verificar si existe un duplicado exacto en la BD
    SELECT COUNT(*)
    INTO existing_duplicate_count
    FROM transactions_bank
    WHERE date = NEW.date
      AND time = NEW.time
      AND concept = NEW.concept
      AND amount = NEW.amount
      AND bank_name = NEW.bank_name;

    -- Si existe un duplicado exacto, ignorar la inserción (retornar NULL)
    IF existing_duplicate_count > 0 THEN
        RAISE NOTICE 'Ignorando transacción duplicada. Fecha: %, Hora: %, Concepto: %, Monto: %, Banco: %',
            NEW.date, NEW.time, NEW.concept, NEW.amount, NEW.bank_name;
        RETURN NULL; -- Ignora la inserción sin error
    END IF;

    -- Si no es duplicado, permitir la inserción
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger que ejecuta la función antes de cada INSERT
DROP TRIGGER IF EXISTS trigger_check_transaction_duplicate ON transactions_bank;

CREATE TRIGGER trigger_check_transaction_duplicate
    BEFORE INSERT ON transactions_bank
    FOR EACH ROW
    EXECUTE FUNCTION check_transaction_duplicate();

-- Comentarios explicativos:
-- 1. La función se ejecuta ANTES de cada INSERT en transactions_bank
-- 2. Obtiene el último registro de last_transaction_bank como referencia
-- 3. Aplica las reglas de negocio definidas:
--    - Si no hay referencia: permite inserción
--    - Si banco diferente: permite inserción
--    - Si fecha anterior: ignora inserción (RETURN NULL)
--    - Si fecha posterior: permite inserción
--    - Si fecha igual: verifica duplicados exactos
-- 4. Un duplicado se define como coincidencia exacta en: date, time, concept, amount, bank_name
-- 5. Si es duplicado: ignora inserción silenciosamente (RETURN NULL)
-- 6. Si no es duplicado: permite inserción
-- 7. RETURN NULL hace que PostgreSQL ignore la inserción sin generar error
-- 8. Se usan RAISE NOTICE para logging sin interrumpir el proceso