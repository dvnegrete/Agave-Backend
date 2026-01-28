import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddValidationStatusEnumValues implements MigrationInterface {
  name = 'AddValidationStatusEnumValues' + Date.now();

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar nuevos valores al enum validation_status_t
    // PostgreSQL no permite agregar valores si ya existen, por eso usamos IF NOT EXISTS

    await queryRunner.query(`
      DO $$
      BEGIN
        -- Agregar 'requires-manual' si no existe
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'requires-manual'
          AND enumtypid = 'transactions_status_validation_status_enum'::regtype
        ) THEN
          ALTER TYPE transactions_status_validation_status_enum ADD VALUE 'requires-manual';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        -- Agregar 'conflict' si no existe
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'conflict'
          AND enumtypid = 'transactions_status_validation_status_enum'::regtype
        ) THEN
          ALTER TYPE transactions_status_validation_status_enum ADD VALUE 'conflict';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // NOTA: PostgreSQL no permite eliminar valores de un enum de forma sencilla
    // Si necesitas revertir, deberías:
    // 1. Crear un nuevo enum sin esos valores
    // 2. Alterar la tabla para usar el nuevo enum
    // 3. Eliminar el enum antiguo
    // 4. Renombrar el nuevo enum

    // Por simplicidad, esta migration no se puede revertir automáticamente
    // Si realmente necesitas revertir, deberás hacerlo manualmente

    console.warn(
      'WARNING: Cannot automatically remove enum values in PostgreSQL. ' +
      'To revert this migration, you must manually recreate the enum type.'
    );

    // No hacemos nada en el down porque es complejo y raramente necesario
  }
}
