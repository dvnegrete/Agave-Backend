import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { UserRecord, ListUsersResult } from 'firebase-admin/auth';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../.env') });

const projectId = process.env.PROJECT_ID_GCP;
const clientEmail = process.env.CLIENT_EMAIL_GCP;
const privateKey = process.env.PRIVATE_KEY_GCP?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  // eslint-disable-next-line no-console
  console.error('❌ Faltan variables de entorno:');
  // eslint-disable-next-line no-console
  console.error('   - PROJECT_ID_GCP');
  // eslint-disable-next-line no-console
  console.error('   - CLIENT_EMAIL_GCP');
  // eslint-disable-next-line no-console
  console.error('   - PRIVATE_KEY_GCP');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({projectId, clientEmail, privateKey}),
});

interface ExportedUser {
  id: string;
  email: string | null;
  name: string | null;
  email_verified: boolean;
  created_at: Date;
  last_login: Date | null;
}

async function exportUsers(): Promise<void> {
  const auth = admin.auth();
  const users: ExportedUser[] = [];
  let pageToken: string | undefined;

  // eslint-disable-next-line no-console
  console.log('🔄 Extrayendo usuarios de Firebase...');

  try {
    do {
      const result: ListUsersResult = await auth.listUsers(1000, pageToken);

      result.users.forEach((user: UserRecord) => {
        users.push({
          id: user.uid,
          email: user.email || null,
          name: user.displayName || user.email || null,
          email_verified: user.emailVerified,
          created_at: new Date(user.metadata.creationTime),
          last_login: user.metadata.lastSignInTime
            ? new Date(user.metadata.lastSignInTime)
            : null,
        });
      });

      pageToken = result.pageToken;
      // eslint-disable-next-line no-console
      console.log(`✅ Procesados ${users.length} usuarios...`);
    } while (pageToken);

    // Guardar en JSON
    const outputPath = path.join(__dirname, '../../firebase-users.json');
    fs.writeFileSync(outputPath, JSON.stringify(users, null, 2));

    // eslint-disable-next-line no-console
    console.log(`\n✅ Exportados ${users.length} usuarios`);
    // eslint-disable-next-line no-console
    console.log(`📁 Guardado en: ${outputPath}`);

    process.exit(0);
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('❌ Error extrayendo usuarios:', error);
    process.exit(1);
  }
}

exportUsers();
