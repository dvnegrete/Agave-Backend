import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GoogleCloudConfig {
  projectId: string;
  applicationCredentials: string;
  voucherBucketName: string | null;
  region?: string;
  zone?: string;
}

@Injectable()
export class GoogleCloudConfigService {
  private readonly logger = new Logger(GoogleCloudConfigService.name);

  constructor(private configService: ConfigService) {}

  get projectId(): string {
    const projectId = this.configService.get<string>('PROJECT_ID_GCP');
    if (!projectId) {
      throw new Error('PROJECT_ID_GCP no está configurada');
    }
    return projectId;
  }

  get applicationCredentials(): string {
    // Construir el objeto de credenciales desde las variables de entorno
    const credentials = {
      type: 'service_account',
      project_id: this.configService.get<string>('PROJECT_ID_GCP'),
      private_key_id: this.configService.get<string>('PRIVATE_KEY_ID'),
      private_key: this.configService.get<string>('PRIVATE_KEY_GCP')?.replace(/\\n/g, '\n'),
      client_email: this.configService.get<string>('CLIENT_EMAIL_GCP'),
      client_id: this.configService.get<string>('CLIENT_ID_GCP'),
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${this.configService.get<string>('CLIENT_EMAIL_GCP')}`,
    };

    // Validar que todas las credenciales estén presentes
    if (!credentials.project_id || !credentials.private_key || !credentials.client_email) {
      throw new Error('Credenciales de Google Cloud incompletas. Verifica PROJECT_ID_GCP, PRIVATE_KEY_GCP, y CLIENT_EMAIL_GCP');
    }

    return JSON.stringify(credentials);
  }

  get region(): string {
    return this.configService.get<string>('GOOGLE_CLOUD_REGION', 'us-central1');
  }

  get zone(): string {
    return this.configService.get<string>('GOOGLE_CLOUD_ZONE', 'us-central1-a');
  }

  get voucherBucketName(): string | null {
    const bucketName = this.configService.get<string>('BUCKET_NAME_VOUCHERS');
    if (!bucketName) {
      this.logger.warn('BUCKET_NAME_VOUCHERS no está configurada');
      return null;
    }
    return bucketName;
  }

  get isEnabled(): boolean {
    return !!(
      this.configService.get<string>('PROJECT_ID_GCP') &&
      this.configService.get<string>('PRIVATE_KEY_GCP') &&
      this.configService.get<string>('CLIENT_EMAIL_GCP')
    );
  }

  getConfig(): GoogleCloudConfig {
    return {
      projectId: this.projectId,
      applicationCredentials: this.applicationCredentials,
      voucherBucketName: this.voucherBucketName,
      region: this.region,
      zone: this.zone,
    };
  }

  validateConfig(): boolean {
    try {
      this.getConfig();
      return true;
    } catch (error) {
      this.logger.warn('Configuración de Google Cloud incompleta:', error.message);
      return false;
    }
  }
}
