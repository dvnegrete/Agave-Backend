import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migración correctiva para manejar valores NULL en user_id antes de cambiar el tipo
 *
 * Problema: La migración 1769459798239-ChangeUserIdToVarchar falló porque
 * había registros con user_id = NULL en la tabla houses
 *
 * Solución:
 * 1. Actualizar todos los NULL a '00000000-0000-0000-0000-000000000000' (usuario del sistema)
 * 2. Agregar constraint NOT NULL
 * 3. Después proceder con el cambio de tipo si es necesario
 *
 * Usuario del sistema:
 * - ID: 00000000-0000-0000-0000-000000000000
 * - Email: sistema@conciliacion.local
 * - Role: tenant
 */
export class FixNullUserIdBeforeTypeChange1769550000001 implements MigrationInterface {
    name = 'FixNullUserIdBeforeTypeChange1769550000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Actualizar NULL valores en houses.user_id al usuario del sistema
        await queryRunner.query(`
            UPDATE "houses"
            SET "user_id" = '00000000-0000-0000-0000-000000000000'
            WHERE "user_id" IS NULL
        `);

        // 2. Actualizar NULL valores en manual_validation_approvals.approved_by_user_id
        await queryRunner.query(`
            UPDATE "manual_validation_approvals"
            SET "approved_by_user_id" = '00000000-0000-0000-0000-000000000000'
            WHERE "approved_by_user_id" IS NULL
        `);

        // 3. Si la columna user_id aún no es NOT NULL, agregarlo
        // Primero verificar el estado actual
        const userIdConstraint = await queryRunner.query(`
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'houses'
            AND column_name = 'user_id'
            AND constraint_type = 'NOT NULL'
        `);

        if (userIdConstraint.length === 0) {
            // Agregar NOT NULL si no existe
            await queryRunner.query(`
                ALTER TABLE "houses"
                ALTER COLUMN "user_id" SET NOT NULL
            `);
        }

        // 4. Verificar el tipo de dato y hacer la conversión si es necesario
        const userIdType = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'houses' AND column_name = 'user_id'
        `);

        // Si es UUID, cambiar a varchar(128)
        if (userIdType.length > 0 && userIdType[0].data_type === 'uuid') {
            // Primero eliminar la FK para poder cambiar el tipo
            const fkConstraint = await queryRunner.query(`
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_name = 'houses'
                AND constraint_type = 'FOREIGN KEY'
                AND column_name = 'user_id'
            `);

            if (fkConstraint.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE "houses"
                    DROP CONSTRAINT "${fkConstraint[0].constraint_name}"
                `);
            }

            // Cambiar el tipo de uuid a varchar(128)
            await queryRunner.query(`
                ALTER TABLE "houses"
                ALTER COLUMN "user_id" TYPE character varying(128) USING "user_id"::text
            `);

            // Recrear la FK
            await queryRunner.query(`
                ALTER TABLE "houses"
                ADD CONSTRAINT "FK_307de020b40481f780f391df54e"
                FOREIGN KEY ("user_id")
                REFERENCES "users"("id")
                ON DELETE CASCADE ON UPDATE CASCADE
            `);
        }

        // 5. Hacer lo mismo para manual_validation_approvals.approved_by_user_id
        const approvedByType = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'manual_validation_approvals' AND column_name = 'approved_by_user_id'
        `);

        if (approvedByType.length > 0 && approvedByType[0].data_type === 'uuid') {
            const fkConstraint = await queryRunner.query(`
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_name = 'manual_validation_approvals'
                AND constraint_type = 'FOREIGN KEY'
                AND column_name = 'approved_by_user_id'
            `);

            if (fkConstraint.length > 0) {
                await queryRunner.query(`
                    ALTER TABLE "manual_validation_approvals"
                    DROP CONSTRAINT "${fkConstraint[0].constraint_name}"
                `);
            }

            await queryRunner.query(`
                ALTER TABLE "manual_validation_approvals"
                ALTER COLUMN "approved_by_user_id" TYPE character varying(128) USING "approved_by_user_id"::text
            `);

            await queryRunner.query(`
                ALTER TABLE "manual_validation_approvals"
                ADD CONSTRAINT "FK_f7aeed4f19c3a693fde06f26093"
                FOREIGN KEY ("approved_by_user_id")
                REFERENCES "users"("id")
                ON DELETE RESTRICT ON UPDATE NO ACTION
            `);
        }

        console.log('✅ Migración correctiva completada - NULLs actualizados al usuario del sistema');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revertir no es práctico en este caso, ya que requeriría
        // identificar qué registros fueron actualizados
        console.log('⚠️ Rollback no disponible - migración es permanente');
    }
}
