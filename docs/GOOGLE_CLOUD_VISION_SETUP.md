# Configuración de Google Cloud Vision API

Este documento explica cómo configurar Google Cloud Vision API para el servicio OCR de vouchers.

## Prerrequisitos

1. Una cuenta de Google Cloud Platform (GCP)
2. Un proyecto de GCP habilitado
3. Facturación habilitada en el proyecto

## Pasos de Configuración

### 1. Habilitar Google Cloud Vision API

1. Ve a la [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto
3. Ve a "APIs y servicios" > "Biblioteca"
4. Busca "Cloud Vision API"
5. Haz clic en "Cloud Vision API" y luego en "Habilitar"

### 2. Crear una cuenta de servicio

1. Ve a "APIs y servicios" > "Credenciales"
2. Haz clic en "Crear credenciales" > "Cuenta de servicio"
3. Completa la información:
   - **Nombre**: `agave-vision-api`
   - **Descripción**: `Cuenta de servicio para OCR de vouchers`
4. Haz clic en "Crear y continuar"
5. En "Otorgar acceso a esta cuenta de servicio", selecciona:
   - **Rol**: `Cloud Vision API User`
6. Haz clic en "Listo"

### 3. Generar la clave de la cuenta de servicio

1. En la lista de cuentas de servicio, haz clic en la que acabas de crear
2. Ve a la pestaña "Claves"
3. Haz clic en "Agregar clave" > "Crear nueva clave"
4. Selecciona "JSON" y haz clic en "Crear"
5. Se descargará un archivo JSON con las credenciales

### 4. Configurar variables de entorno

Crea o actualiza tu archivo `.env` con las siguientes variables:

```env
# Google Cloud Vision API
GOOGLE_APPLICATION_CREDENTIALS=/ruta/completa/al/archivo/credenciales.json
GOOGLE_CLOUD_PROJECT_ID=tu-project-id
```

**Nota**: Reemplaza `/ruta/completa/al/archivo/credenciales.json` con la ruta real donde guardaste el archivo JSON de credenciales.

### 5. Verificar la configuración

Una vez configurado, puedes probar el endpoint:

```bash
# Obtener idiomas soportados
curl -X GET http://localhost:3000/vouchers/ocr-service/languages

# Procesar una imagen
curl -X POST http://localhost:3000/vouchers/ocr-service \
  -F "image=@/ruta/a/tu/imagen.jpg" \
  -F "language=es"
```

## Uso del Endpoint

### POST /vouchers/ocr-service

Procesa una imagen y extrae el texto usando OCR.

**Parámetros:**
- `image` (file): Archivo de imagen (JPEG, PNG, GIF, BMP, WEBP, TIFF)
- `language` (opcional): Código de idioma (ej: "es", "en", "fr")

**Ejemplo de respuesta:**
```json
{
  "text": "Texto extraído de la imagen",
  "confidence": 0.95,
  "language": "es",
  "boundingBoxes": [
    {
      "text": "palabra",
      "confidence": 0.98,
      "bounds": {
        "left": 10,
        "top": 20,
        "width": 50,
        "height": 15
      }
    }
  ],
  "processingTime": 1250,
  "originalFilename": "imagen.jpg"
}
```

### GET /vouchers/ocr-service/languages

Obtiene la lista de idiomas soportados.

**Ejemplo de respuesta:**
```json
{
  "languages": ["es", "en", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh", "ar", "hi"]
}
```

## Solución de Problemas

### Error: "Archivo de credenciales de Google Cloud no encontrado"
- Verifica que la ruta en `GOOGLE_APPLICATION_CREDENTIALS` sea correcta
- Asegúrate de que el archivo JSON existe y es legible

### Error: "Sin permisos para acceder a Google Vision API"
- Verifica que la cuenta de servicio tenga el rol `Cloud Vision API User`
- Asegúrate de que la API esté habilitada en tu proyecto

### Error: "No se detectó texto en la imagen"
- La imagen puede no contener texto legible
- Intenta con una imagen de mejor calidad
- Verifica que el texto esté bien contrastado

## Costos

Google Cloud Vision API tiene un costo por cada 1000 solicitudes. Consulta la [página de precios](https://cloud.google.com/vision/pricing) para más detalles.

## Seguridad

- Nunca subas el archivo de credenciales a control de versiones
- Usa variables de entorno para las credenciales en producción
- Considera usar Google Cloud Secret Manager para mayor seguridad

