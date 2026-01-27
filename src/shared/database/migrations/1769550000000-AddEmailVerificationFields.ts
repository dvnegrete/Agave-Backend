import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmailVerificationFields1769550000000 implements MigrationInterface {
  name = 'AddEmailVerificationFields1769550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si las columnas ya existen (idempotente)
    const table = await queryRunner.getTable('users');
    const emailVerifiedExists = table?.columns.find(
      (col) => col.name === 'email_verified',
    );
    const emailVerifiedAtExists = table?.columns.find(
      (col) => col.name === 'email_verified_at',
    );

    // Si ambas columnas existen, no hacer nada
    if (emailVerifiedExists && emailVerifiedAtExists) {
      console.log(
        'Email verification columns already exist - migration skipped',
      );
      return;
    }

    // Agregar columna email_verified si no existe
    if (!emailVerifiedExists) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'email_verified',
          type: 'boolean',
          default: false,
        }),
      );
    }

    // Agregar columna email_verified_at si no existe
    if (!emailVerifiedAtExists) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'email_verified_at',
          type: 'timestamp',
          isNullable: true,
          default: null,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('users');

    // Eliminar columnas si existen
    if (table?.columns.find((col) => col.name === 'email_verified_at')) {
      await queryRunner.dropColumn('users', 'email_verified_at');
    }

    if (table?.columns.find((col) => col.name === 'email_verified')) {
      await queryRunner.dropColumn('users', 'email_verified');
    }
  }
}
