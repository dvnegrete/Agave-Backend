import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeUserIdToVarchar1769459798239 implements MigrationInterface {
    name = 'ChangeUserIdToVarchar1769459798239'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Verificar si users.id ya es varchar (idempotente)
        const userIdType = await queryRunner.query(
            `SELECT data_type FROM information_schema.columns
             WHERE table_name='users' AND column_name='id'`
        );

        // Si ya es character varying, no hacer nada (ya migrado)
        if (userIdType.length > 0 && userIdType[0].data_type === 'character varying') {
            console.log('users.id ya es character varying - migracion saltada');
            return;
        }

        // PASO 1: Actualizar NULLs al usuario del sistema antes de cambiar tipos
        console.log('Actualizando NULL valores al usuario del sistema...');
        await queryRunner.query(`
            UPDATE "houses"
            SET "user_id" = '00000000-0000-0000-0000-000000000000'
            WHERE "user_id" IS NULL
        `);
        await queryRunner.query(`
            UPDATE "manual_validation_approvals"
            SET "approved_by_user_id" = '00000000-0000-0000-0000-000000000000'
            WHERE "approved_by_user_id" IS NULL
        `);

        // PASO 2: Ejecutar la migración de tipos
        console.log('Cambiando tipos de datos...');
        await queryRunner.query(`ALTER TABLE "houses" DROP CONSTRAINT "FK_307de020b40481f780f391df54e"`);
        await queryRunner.query(`ALTER TABLE "houses" ALTER COLUMN "user_id" TYPE character varying(128) USING "user_id"::text`);
        await queryRunner.query(`ALTER TABLE "houses" ALTER COLUMN "user_id" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" DROP CONSTRAINT IF EXISTS "FK_f7aeed4f19c3a693fde06f26093"`);
        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" ALTER COLUMN "approved_by_user_id" TYPE character varying(128) USING "approved_by_user_id"::text`);
        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" ALTER COLUMN "approved_by_user_id" SET NOT NULL`);

        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_pkey"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "id" TYPE character varying(128) USING "id"::text`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")`);

        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_manual_validation_approvals_user"`);
        await queryRunner.query(`CREATE INDEX "idx_manual_validation_approvals_user" ON "manual_validation_approvals" ("approved_by_user_id") `);

        await queryRunner.query(`ALTER TABLE "houses" ADD CONSTRAINT "FK_307de020b40481f780f391df54e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" ADD CONSTRAINT "FK_f7aeed4f19c3a693fde06f26093" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        console.log('✅ Migración completada exitosamente');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" DROP CONSTRAINT IF EXISTS "FK_f7aeed4f19c3a693fde06f26093"`);
        await queryRunner.query(`ALTER TABLE "houses" DROP CONSTRAINT IF EXISTS "FK_307de020b40481f780f391df54e"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_manual_validation_approvals_user"`);
        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" DROP COLUMN IF EXISTS "approved_by_user_id"`);
        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" ADD "approved_by_user_id" uuid NOT NULL`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_manual_validation_approvals_user" ON "manual_validation_approvals" ("approved_by_user_id") `);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "PK_a3ffb1c0c8416b9fc6f907b7433"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "id"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "manual_validation_approvals" ADD CONSTRAINT "FK_f7aeed4f19c3a693fde06f26093" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "houses" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`);
        await queryRunner.query(`ALTER TABLE "houses" ADD CONSTRAINT "FK_307de020b40481f780f391df54e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

}
