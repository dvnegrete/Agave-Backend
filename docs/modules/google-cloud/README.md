# Librería de Google Cloud Platform

Esta librería proporciona una interfaz unificada para acceder a múltiples servicios de Google Cloud Platform desde una sola instancia.

## Características

- **Patrón Singleton**: Una sola instancia del cliente para toda la aplicación
- **Inicialización bajo demanda**: Los servicios se inicializan solo cuando se necesitan
- **Manejo de errores robusto**: Gestión automática de errores de configuración
- **Múltiples servicios**: Soporte para Vision API, Storage, Translate, Text-to-Speech y Speech-to-Text
- **Configuración centralizada**: Todas las configuraciones en un solo lugar

## Servicios Disponibles

### 1. Vision API
- **Cliente**: `ImageAnnotatorClient`
- **Uso**: OCR, detección de objetos, análisis de imágenes
- **Método**: `getVisionClient()`
- **Guía de configuración**: Ver [Vision API Setup](vision-api-setup.md)

### 2. Cloud Storage
- **Cliente**: `Storage`
- **Servicio**: `CloudStorageService` (recomendado)
- **Uso**: Almacenamiento de archivos, buckets
- **Métodos**:
  - Acceso directo: `getStorageClient()`
  - Servicio dedicado: Ver [Cloud Storage Service](#cloud-storage-service)

### 3. Cloud Translate
- **Cliente**: `Translate`
- **Uso**: Traducción de texto
- **Método**: `getTranslateClient()`

### 4. Text-to-Speech
- **Cliente**: `TextToSpeechClient`
- **Uso**: Conversión de texto a audio
- **Método**: `getTextToSpeechClient()`

### 5. Speech-to-Text
- **Cliente**: `SpeechClient`
- **Uso**: Conversión de audio a texto
- **Método**: `getSpeechClient()`

## Configuración

### Variables de Entorno Requeridas

```env
# Google Cloud Platform
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
GOOGLE_APPLICATION_CREDENTIALS=/ruta/al/archivo/credenciales.json

# Opcionales
GOOGLE_CLOUD_REGION=us-central1
GOOGLE_CLOUD_ZONE=us-central1-a
```

### Configuración del Módulo

```typescript
import { GoogleCloudModule } from './libs/google-cloud';

@Module({
  imports: [GoogleCloudModule],
  // ... resto de la configuración
})
export class AppModule {}
```

## Uso

### Inyección de Dependencias

```typescript
import { Injectable } from '@nestjs/common';
import { GoogleCloudClient } from './libs/google-cloud';

@Injectable()
export class MiServicio {
  constructor(private readonly googleCloudClient: GoogleCloudClient) {}

  async procesarImagen(imageBuffer: Buffer) {
    const visionClient = this.googleCloudClient.getVisionClient();
    if (!visionClient) {
      throw new Error('Vision API no está disponible');
    }

    // Usar el cliente de Vision API
    const [result] = await visionClient.annotateImage({
      image: { content: imageBuffer.toString('base64') },
      features: [{ type: 'TEXT_DETECTION' }],
    });

    return result;
  }
}
```

### Uso Directo de la Fábrica

```typescript
import { createGoogleCloudClient } from './libs/google-cloud';

const googleCloudClient = createGoogleCloudClient(configService);
const visionClient = googleCloudClient.getVisionClient();
```

## Ejemplos de Uso

### Vision API (OCR)

```typescript
async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  const visionClient = this.googleCloudClient.getVisionClient();
  if (!visionClient) {
    throw new Error('Vision API no disponible');
  }

  const [result] = await visionClient.annotateImage({
    image: { content: imageBuffer.toString('base64') },
    features: [{ type: 'TEXT_DETECTION' }],
  });

  return result.textAnnotations?.[0]?.text || '';
}
```

### Cloud Storage (Acceso Directo)

```typescript
async uploadFile(bucketName: string, fileName: string, fileBuffer: Buffer): Promise<void> {
  const storageClient = this.googleCloudClient.getStorageClient();
  if (!storageClient) {
    throw new Error('Cloud Storage no disponible');
  }

  const bucket = storageClient.bucket(bucketName);
  const file = bucket.file(fileName);

  await file.save(fileBuffer);
}
```

**⚠️ Nota**: Se recomienda usar `CloudStorageService` en lugar de acceso directo. Ver [Cloud Storage Service](#cloud-storage-service).

### Cloud Translate

```typescript
async translateText(text: string, targetLanguage: string): Promise<string> {
  const translateClient = this.googleCloudClient.getTranslateClient();
  if (!translateClient) {
    throw new Error('Cloud Translate no disponible');
  }

  const [translation] = await translateClient.translate(text, targetLanguage);
  return translation;
}
```

## Manejo de Errores

La librería maneja automáticamente los errores de configuración:

- Si las credenciales no están configuradas, los métodos devuelven `null`
- Los errores de inicialización se registran en los logs
- El servicio funciona en modo simulación cuando no hay configuración

## Testing

Para testing, puedes usar las funciones de limpieza:

```typescript
import { clearGoogleCloudClient } from './libs/google-cloud';

beforeEach(() => {
  clearGoogleCloudClient();
});
```

## Estructura de Archivos

```
src/libs/google-cloud/
├── index.ts                 # Exportaciones principales
├── google-cloud.config.ts   # Configuración
├── google-cloud.client.ts   # Cliente principal
├── google-cloud.factory.ts  # Fábrica Singleton
├── google-cloud.module.ts   # Módulo NestJS
└── README.md               # Esta documentación
```

## Dependencias

- `@google-cloud/vision`
- `@google-cloud/storage`
- `@google-cloud/translate`
- `@google-cloud/text-to-speech`
- `@google-cloud/speech`

## Cloud Storage Service

### Descripción

`CloudStorageService` es un servicio dedicado para gestionar archivos en Google Cloud Storage de forma centralizada, proporcionando una interfaz limpia y fácil de usar.

**Ubicación**: `src/shared/libs/google-cloud/storage/cloud-storage.service.ts`

### Ventajas

- **Centralizado**: Toda la lógica de Storage en un solo lugar
- **Reutilizable**: Cualquier servicio puede usar las mismas funciones
- **Type-safe**: Interfaces TypeScript para todas las operaciones
- **Documentado**: JSDoc completo en todas las funciones
- **Mantenible**: Cambios en Cloud Storage solo en un archivo

### Uso Básico

```typescript
import { CloudStorageService } from '@/shared/libs/google-cloud';

@Injectable()
export class MyService {
  constructor(
    private readonly cloudStorageService: CloudStorageService,
  ) {}
}
```

### Funciones Disponibles

#### 1. `upload(buffer, fileName, options)`

Sube un archivo a Cloud Storage con nombre único automático.

```typescript
const result = await this.cloudStorageService.upload(
  fileBuffer,
  'comprobante.jpg',
  {
    prefix: 'vouchers/',
    generateUniqueName: true
  }
);

console.log(result.gcsUri);
// gs://bucket/vouchers/p-2024-10-03_14-30-00-abc123.jpg
```

**Opciones disponibles**:
- `bucketName`: Bucket destino (usa default si no se especifica)
- `prefix`: Prefijo para el nombre (ej: "vouchers/")
- `fileName`: Nombre personalizado
- `generateUniqueName`: Generar nombre único con timestamp + UUID
- `metadata`: Metadatos adicionales
- `contentType`: MIME type del archivo

#### 2. `getAllFiles(options)`

Obtiene lista de archivos de un bucket.

```typescript
// Obtener todos los archivos de vouchers
const files = await this.cloudStorageService.getAllFiles({
  prefix: 'vouchers/',
  maxResults: 100
});

console.log(files[0]);
// {
//   name: 'vouchers/file.jpg',
//   size: 245678,
//   contentType: 'image/jpeg',
//   created: Date,
//   gcsUri: 'gs://bucket/vouchers/file.jpg'
// }
```

#### 3. `deleteFile(fileName, bucketName?)`

Elimina un archivo específico.

```typescript
await this.cloudStorageService.deleteFile('vouchers/old-file.jpg');
```

#### 4. `deleteMultipleFiles(fileNames, bucketName?)`

Elimina múltiples archivos en paralelo.

```typescript
await this.cloudStorageService.deleteMultipleFiles([
  'ocr-results/file1.json',
  'ocr-results/file2.json',
  'ocr-results/file3.json'
]);
```

#### 5. `downloadFile(fileName, bucketName?)`

Descarga el contenido de un archivo.

```typescript
const fileContent = await this.cloudStorageService.downloadFile(
  'ocr-results/result.json'
);
const jsonData = JSON.parse(fileContent.toString());
```

#### 6. `getSignedUrl(fileName, options)`

Genera una URL firmada para acceso temporal a archivos privados.

```typescript
// URL firmada válida por 1 hora (default)
const signedUrl = await this.cloudStorageService.getSignedUrl(
  'vouchers/comprobante.jpg'
);

// URL firmada personalizada
const signedUrl = await this.cloudStorageService.getSignedUrl(
  'vouchers/comprobante.jpg',
  {
    expiresInMinutes: 30,  // Válida por 30 minutos
    action: 'read'         // Permiso de lectura
  }
);

// Usar en frontend
return {
  id: voucher.id,
  viewUrl: signedUrl  // URL temporal para visualizar el archivo
};
```

**Opciones disponibles:**
- `bucketName`: Bucket del archivo (opcional)
- `expiresInMinutes`: Tiempo de validez en minutos (default: 60)
- `action`: Tipo de acción ('read', 'write', 'delete')

**Casos de uso:**
- Mostrar comprobantes en frontend sin hacer público el bucket
- Compartir archivos temporalmente
- Acceso controlado a documentos sensibles

#### 7. Funciones auxiliares

```typescript
// Verificar si existe
const exists = await this.cloudStorageService.fileExists('file.jpg');

// Obtener URL pública
const url = this.cloudStorageService.getPublicUrl('file.jpg');

// Obtener URI de GCS
const uri = this.cloudStorageService.getGcsUri('file.jpg');
```

### Ejemplo Completo: Procesamiento de Vouchers

```typescript
@Injectable()
export class OcrService {
  constructor(
    private readonly cloudStorageService: CloudStorageService,
    private readonly visionClient: ImageAnnotatorClient,
  ) {}

  async processVoucher(imageBuffer: Buffer, fileName: string) {
    // 1. Subir archivo a GCS
    const uploadResult = await this.cloudStorageService.upload(
      imageBuffer,
      fileName,
      { prefix: 'vouchers/', generateUniqueName: true }
    );

    // 2. Procesar con Vision API
    const [result] = await this.visionClient.annotateImage({
      image: { source: { imageUri: uploadResult.gcsUri } },
      features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
    });

    // 3. Obtener archivos temporales de OCR
    const tempFiles = await this.cloudStorageService.getAllFiles({
      prefix: 'ocr-results/'
    });

    // 4. Descargar y procesar resultados
    for (const file of tempFiles) {
      const content = await this.cloudStorageService.downloadFile(file.name);
      const resultJson = JSON.parse(content.toString());
      // Procesar resultJson...
    }

    // 5. Limpiar archivos temporales
    await this.cloudStorageService.deleteMultipleFiles(
      tempFiles.map(f => f.name)
    );

    return {
      text: result.fullTextAnnotation?.text,
      gcsUri: uploadResult.gcsUri
    };
  }
}
```

### Configuración

El servicio utiliza el bucket configurado en:

```env
VOUCHER_BUCKET_NAME=my-bucket-name
```

Para usar un bucket diferente:

```typescript
await this.cloudStorageService.upload(buffer, fileName, {
  bucketName: 'my-custom-bucket'
});
```

### Manejo de Errores

Todas las funciones lanzan `BadRequestException` en caso de error:

```typescript
try {
  await this.cloudStorageService.upload(buffer, fileName);
} catch (error) {
  console.error('Error:', error.message);
  // Error al subir archivo a Cloud Storage: ...
}
```

## Guías de Configuración

- [**Vision API Setup**](vision-api-setup.md) - Configuración completa de Google Cloud Vision API para OCR

## Notas Importantes

1. **Credenciales**: Nunca subas las credenciales a control de versiones
2. **Costos**: Cada servicio de Google Cloud tiene costos asociados
3. **Límites**: Revisa los límites de cuota de cada API
4. **Región**: Configura la región apropiada para tu aplicación
5. **Cloud Storage**: Usa `CloudStorageService` en lugar de acceso directo al cliente

## Documentación Relacionada

- [Vouchers Feature](../../features/vouchers/README.md) - Implementación de OCR para comprobantes
- [Vouchers Technical Docs](../../features/vouchers/TECHNICAL.md) - Arquitectura técnica y servicios OCR
- [Database Schema](../../database/schema.md) - Estructura de base de datos
