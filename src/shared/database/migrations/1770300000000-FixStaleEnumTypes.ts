import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración de limpieza: elimina tipos enum residuales `_old` que TypeORM synchronize
 * puede haber dejado por una sincronización fallida.
 *
 * También renombra los tipos enum legacy (`validation_status_t`, `role_t`, `status_t`)
 * a los nombres que TypeORM espera, para evitar conflictos futuros con synchronize.
 *
 * NOTA: Ahora las entities usan `enumName` explícito que apunta a los nombres originales,
 * así que esta migración solo limpia tipos `_old` residuales.
 */
export class FixStaleEnumTypes1770300000000 implements MigrationInterface {
  name = 'FixStaleEnumTypes1770300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Buscar y eliminar tipos _old residuales
    const staleTypes: Array<{ typname: string }> = await queryRunner.query(`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typtype = 'e'
        AND t.typname LIKE '%_old'
    `);

    if (staleTypes.length === 0) {
      console.log('Migration: No stale _old enum types found. Skipping.');
      return;
    }

    for (const staleType of staleTypes) {
      console.log(
        `Migration: Dropping stale enum type "${staleType.typname}"`,
      );
      await queryRunner.query(
        `DROP TYPE IF EXISTS "public"."${staleType.typname}" CASCADE`,
      );
    }

    console.log(
      `Migration: Cleaned up ${staleTypes.length} stale enum type(s).`,
    );
  }

  public async down(): Promise<void> {
    // No action - stale types shouldn't be restored
    console.log(
      'Migration: FixStaleEnumTypes down - no action (stale types should not be restored).',
    );
  }
}
