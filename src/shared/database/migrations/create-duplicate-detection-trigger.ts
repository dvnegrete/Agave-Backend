import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDuplicateDetectionTrigger implements MigrationInterface {
  name = 'CreateDuplicateDetectionTrigger' + Date.now();

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Crear la función de detección de duplicados
    await queryRunner.query(`
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
                JOIN transactions_bank tb ON ltb.transactions_bank_id = tb.id
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
        `);

    // Crear el trigger
    await queryRunner.query(`
            -- Eliminar trigger existente si existe
            DROP TRIGGER IF EXISTS trigger_check_transaction_duplicate ON transactions_bank;

            -- Crear el nuevo trigger
            CREATE TRIGGER trigger_check_transaction_duplicate
                BEFORE INSERT ON transactions_bank
                FOR EACH ROW
                EXECUTE FUNCTION check_transaction_duplicate();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Eliminar el trigger
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS trigger_check_transaction_duplicate ON transactions_bank;
        `);

    // Eliminar la función
    await queryRunner.query(`
            DROP FUNCTION IF EXISTS check_transaction_duplicate();
        `);
  }
}
