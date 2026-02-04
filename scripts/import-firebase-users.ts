import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

interface FirebaseUser {
  id: string;
  email: string | null;
  name: string | null;
  email_verified: boolean;
  created_at: string;
  last_login: string | null;
}

async function importFirebaseUsers(): Promise<void> {
  const firebaseUsersPath = path.join(__dirname, '../../firebase-users.json');

  if (!fs.existsSync(firebaseUsersPath)) {
    // eslint-disable-next-line no-console
    console.error(
      '❌ Archivo firebase-users.json no encontrado. Ejecuta primero: npx ts-node scripts/export-firebase-users.ts',
    );
    process.exit(1);
  }

  const firebaseUsers: FirebaseUser[] = JSON.parse(
    fs.readFileSync(firebaseUsersPath, 'utf-8'),
  );

  // eslint-disable-next-line no-console
  console.log(`📥 Importando ${firebaseUsers.length} usuarios desde Firebase...`);

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    // eslint-disable-next-line no-console
    console.error('❌ DATABASE_URL no está configurado');
    process.exit(1);
  }

  // Usar cliente pg directo (más simple que TypeORM)
  const client = new Client({
    connectionString: databaseUrl,
    ssl:
      process.env.NODE_ENV === 'development'
        ? false
        : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    // eslint-disable-next-line no-console
    console.log('✅ Conectado a la base de datos');

    let imported = 0;
    let skipped = 0;

    for (const fbUser of firebaseUsers) {
      try {
        // Verificar si el usuario ya existe
        const existing = await client.query(
          'SELECT id FROM users WHERE id = $1',
          [fbUser.id],
        );

        if (existing.rows.length > 0) {
          // eslint-disable-next-line no-console
          console.log(`⏭️  Usuario ya existe: ${fbUser.email}`);
          skipped++;
          continue;
        }

        // Insertar usuario
        await client.query(
          `INSERT INTO users (id, email, name, email_verified, role, status, created_at, last_login)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            fbUser.id,
            fbUser.email,
            fbUser.name,
            fbUser.email_verified,
            'tenant',
            'active',
            new Date(fbUser.created_at),
            fbUser.last_login ? new Date(fbUser.last_login) : null,
          ],
        );

        // eslint-disable-next-line no-console
        console.log(`✅ Importado: ${fbUser.email}`);
        imported++;
      } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(
          `❌ Error importando ${fbUser.email}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // eslint-disable-next-line no-console
    console.log(`\n📊 Resumen:`);
    // eslint-disable-next-line no-console
    console.log(`   ✅ Importados: ${imported}`);
    // eslint-disable-next-line no-console
    console.log(`   ⏭️  Ya existían: ${skipped}`);
    // eslint-disable-next-line no-console
    console.log(`   📝 Total procesados: ${firebaseUsers.length}`);

    process.exit(0);
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('❌ Error de conexión:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

importFirebaseUsers();
