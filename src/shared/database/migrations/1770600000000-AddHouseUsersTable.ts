import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración: Tabla junction house_users
 *
 * Introduce relación N:M entre houses y users para permitir que una casa
 * tenga múltiples usuarios asignados. La restricción de negocio de máximo
 * 2 propietarios (role = owner) se aplica en la capa de aplicación.
 *
 * houses.user_id se conserva como "usuario primario" para compatibilidad
 * con reconciliación bancaria y motor de pagos. Los datos existentes se
 * migran automáticamente al INSERT inicial.
 */
export class AddHouseUsersTable1770600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE house_users (
        id          SERIAL PRIMARY KEY,
        house_id    INT           NOT NULL REFERENCES houses(id) ON UPDATE CASCADE ON DELETE CASCADE,
        user_id     VARCHAR(128)  NOT NULL REFERENCES users(id)  ON UPDATE CASCADE ON DELETE CASCADE,
        created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_house_users UNIQUE (house_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_house_users_house_id ON house_users (house_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_house_users_user_id ON house_users (user_id)
    `);

    // Migrar asignaciones existentes (excluye usuario sistema)
    await queryRunner.query(`
      INSERT INTO house_users (house_id, user_id)
      SELECT id, user_id
        FROM houses
       WHERE user_id != '00000000-0000-0000-0000-000000000000'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE house_users`);
  }
}
