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

### 2. Cloud Storage
- **Cliente**: `Storage`
- **Uso**: Almacenamiento de archivos, buckets
- **Método**: `getStorageClient()`

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

### Cloud Storage

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

## Notas Importantes

1. **Credenciales**: Nunca subas las credenciales a control de versiones
2. **Costos**: Cada servicio de Google Cloud tiene costos asociados
3. **Límites**: Revisa los límites de cuota de cada API
4. **Región**: Configura la región apropiada para tu aplicación
