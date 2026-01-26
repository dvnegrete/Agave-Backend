import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAuthConfig {
  private readonly logger = new Logger(FirebaseAuthConfig.name);
  private firebaseApp: admin.app.App | null = null;

  constructor(private configService: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    // Usar variables GCP existentes, mapeadas a nombres Firebase
    const projectId = this.configService.get<string>('PROJECT_ID_GCP');
    const clientEmail = this.configService.get<string>('CLIENT_EMAIL_GCP');
    const privateKey = this.configService.get<string>('PRIVATE_KEY_GCP')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        'Configuración GCP incompleta. Servicio de autenticación deshabilitado. Verifica: PROJECT_ID_GCP, CLIENT_EMAIL_GCP, PRIVATE_KEY_GCP',
      );
      return;
    }

    try {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      this.logger.log('Firebase Auth inicializado correctamente (usando credenciales GCP)');
    } catch (error) {
      this.logger.error('Error al inicializar Firebase:', error);
    }
  }

  getAuth(): admin.auth.Auth {
    if (!this.firebaseApp) {
      throw new Error('Firebase no inicializado. Verifica configuración GCP.');
    }
    return admin.auth(this.firebaseApp);
  }

  isEnabled(): boolean {
    return this.firebaseApp !== null;
  }
}
