# Debugging: URL Firmada No Funciona (GET /vouchers/:id)

## Problema

El endpoint `GET /vouchers/:id` retorna `viewUrl: null` o la URL firmada no funciona.

## Síntomas

```json
{
  "confirmation_status": false,
  "url": "p-2024-10-03_14-30-00-abc123.jpg",
  "viewUrl": null
}
```

O al intentar acceder a `viewUrl`, se recibe un error 403 o 404.

## Causas Comunes

### 1. Archivo No Existe en Google Cloud Storage

**Verificar en logs:**
```
❌ Error al generar URL firmada para p-2024-10-03_14-30-00-abc123.jpg
   Bucket: default
   Error: El archivo p-2024-10-03_14-30-00-abc123.jpg no existe en el bucket
```

**Solución:**
1. Verificar que el archivo existe en GCS:
   ```bash
   gsutil ls gs://your-bucket-name/
   ```

2. Verificar que el nombre del archivo en la base de datos coincide con el nombre en GCS:
   ```sql
   SELECT id, url FROM vouchers WHERE id = X;
   ```

3. Si el archivo no existe, puede ser que:
   - El upload falló silenciosamente
   - El archivo fue eliminado manualmente
   - Hay un error en el flujo de subida de archivos

**Verificar en código:**
- Revisar que `OcrService.extractTextFromImage` está subiendo correctamente
- Verificar logs del upload: `"Archivo subido exitosamente: gs://..."`

---

### 2. Credenciales de Google Cloud No Configuradas

**Verificar en logs:**
```
❌ Error al generar URL firmada
   Error: Could not load the default credentials
```

**Solución:**

1. Verificar que las variables de entorno están configuradas en `.env`:
   ```env
   PROJECT_ID_GCP=your-project-id
   PRIVATE_KEY_ID=your-key-id
   PRIVATE_KEY_GCP="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   CLIENT_EMAIL_GCP=your-service-account@project.iam.gserviceaccount.com
   CLIENT_ID_GCP=123456789
   BUCKET_NAME_VOUCHERS=your-bucket-name
   ```

2. Verificar que `PRIVATE_KEY_GCP` está correctamente formateada:
   - Debe incluir `\n` para los saltos de línea
   - Debe estar entre comillas dobles en `.env`
   - Debe incluir `-----BEGIN PRIVATE KEY-----` y `-----END PRIVATE KEY-----`

3. Verificar permisos de la Service Account:
   - Debe tener rol: `Storage Object Viewer` (mínimo)
   - Recomendado: `Storage Object Admin` para crear/eliminar archivos

---

### 3. Bucket Incorrecto

**Verificar en logs:**
```
📄 Generando URL firmada para voucher 123
   - URL almacenada en BD: p-2024-10-03_14-30-00-abc123.jpg
Generando URL firmada para archivo: p-2024-10-03_14-30-00-abc123.jpg en bucket: wrong-bucket
❌ Error al generar URL firmada
```

**Solución:**

1. Verificar que `BUCKET_NAME_VOUCHERS` en `.env` coincide con el bucket real:
   ```env
   BUCKET_NAME_VOUCHERS=agave-vouchers-prod
   ```

2. Listar buckets disponibles:
   ```bash
   gsutil ls
   ```

3. Verificar que el bucket existe y tiene los permisos correctos

---

### 4. Nombre de Archivo Incluye URI Completa

**Verificar en logs:**
```
📄 Generando URL firmada para voucher 123
   - URL almacenada en BD: gs://bucket/p-2024-10-03_14-30-00-abc123.jpg
```

**Problema:** El campo `voucher.url` contiene la URI completa (`gs://bucket/file`) en lugar de solo el nombre del archivo.

**Solución:**

1. Revisar cómo se guarda en la base de datos:
   ```typescript
   // ❌ INCORRECTO
   url: uploadResult.gcsUri  // "gs://bucket/file.jpg"

   // ✅ CORRECTO
   url: uploadResult.fileName  // "p-2024-10-03_14-30-00-abc123.jpg"
   ```

2. Migrar datos existentes si es necesario:
   ```sql
   -- Extraer solo el nombre del archivo
   UPDATE vouchers
   SET url = SUBSTRING(url FROM 'gs://[^/]+/(.+)')
   WHERE url LIKE 'gs://%';
   ```

---

### 5. Permisos de CORS en el Bucket

**Síntoma:** La URL firmada se genera correctamente pero falla al acceder desde el frontend.

**Error en navegador:**
```
Access to fetch at 'https://storage.googleapis.com/...' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**Solución:**

1. Crear archivo `cors.json`:
   ```json
   [
     {
       "origin": ["http://localhost:3000", "https://your-frontend-domain.com"],
       "method": ["GET"],
       "responseHeader": ["Content-Type"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

2. Aplicar configuración CORS al bucket:
   ```bash
   gsutil cors set cors.json gs://your-bucket-name
   ```

3. Verificar configuración:
   ```bash
   gsutil cors get gs://your-bucket-name
   ```

---

### 6. URL Firmada Expirada

**Síntoma:** La URL funciona inicialmente pero deja de funcionar después de 1 hora.

**Causa:** Las URLs firmadas tienen un tiempo de expiración (por defecto 60 minutos).

**Solución:**

1. Aumentar tiempo de expiración si es necesario:
   ```typescript
   await this.cloudStorageService.getSignedUrl(voucher.url, {
     expiresInMinutes: 240, // 4 horas
     action: 'read',
   });
   ```

2. O implementar endpoint de refresh:
   ```typescript
   @Get(':id/refresh-url')
   async refreshViewUrl(@Param('id') id: string) {
     // Generar nueva URL firmada
   }
   ```

---

## Debugging Paso a Paso

### 1. Verificar logs del servidor

Cuando hagas una petición a `GET /vouchers/:id`, deberías ver:

```
📄 Generando URL firmada para voucher 123
   - URL almacenada en BD: p-2024-10-03_14-30-00-abc123.jpg
[CloudStorageService] Generando URL firmada para archivo: p-2024-10-03_14-30-00-abc123.jpg en bucket: agave-vouchers-prod
[CloudStorageService] ✅ URL firmada generada exitosamente para p-2024-10-03_14-30-00-abc123.jpg (válida por 60 minutos)
   ✅ URL firmada generada exitosamente
   - Válida por: 60 minutos
```

Si ves errores, sigue la guía según el mensaje de error.

### 2. Verificar respuesta del endpoint

```bash
curl -X GET http://localhost:3000/vouchers/123
```

Respuesta esperada:
```json
{
  "confirmation_status": false,
  "url": "p-2024-10-03_14-30-00-abc123.jpg",
  "viewUrl": "https://storage.googleapis.com/agave-vouchers-prod/p-2024-10-03_14-30-00-abc123.jpg?X-Goog-Algorithm=..."
}
```

### 3. Probar la URL firmada

```bash
curl -I "https://storage.googleapis.com/..."
```

Respuesta esperada:
```
HTTP/2 200
content-type: image/jpeg
content-length: 123456
```

Si recibes 403 o 404, revisa las causas anteriores.

### 4. Verificar archivo en GCS

```bash
gsutil ls gs://your-bucket-name/ | grep p-2024-10-03
```

### 5. Probar generación manual de URL firmada

```typescript
// En un endpoint de prueba
@Get('test-signed-url')
async testSignedUrl() {
  const url = await this.cloudStorageService.getSignedUrl(
    'p-2024-10-03_14-30-00-abc123.jpg',
    { expiresInMinutes: 60, action: 'read' }
  );
  return { url };
}
```

---

## Checklist de Verificación

- [ ] Variable `BUCKET_NAME_VOUCHERS` está configurada en `.env`
- [ ] Variables de Google Cloud (`PROJECT_ID_GCP`, `PRIVATE_KEY_GCP`, etc.) están configuradas
- [ ] Service Account tiene permisos `Storage Object Viewer` o `Storage Object Admin`
- [ ] El archivo existe en GCS (verificar con `gsutil ls`)
- [ ] El campo `voucher.url` contiene solo el nombre del archivo (no la URI completa)
- [ ] CORS está configurado si se accede desde frontend
- [ ] Los logs del servidor muestran "✅ URL firmada generada exitosamente"
- [ ] La URL firmada retorna 200 al hacer `curl -I`

---

## Comandos Útiles

```bash
# Listar archivos en bucket
gsutil ls gs://your-bucket-name/

# Buscar archivo específico
gsutil ls gs://your-bucket-name/ | grep filename

# Verificar permisos del bucket
gsutil iam get gs://your-bucket-name/

# Ver configuración CORS
gsutil cors get gs://your-bucket-name

# Descargar archivo para verificar que existe
gsutil cp gs://your-bucket-name/file.jpg /tmp/

# Ver detalles del archivo
gsutil stat gs://your-bucket-name/file.jpg
```

---

## Solución Rápida: Script de Verificación

Crear un endpoint temporal para verificar todo:

```typescript
@Get('debug/storage-config')
async debugStorageConfig() {
  const config = this.googleCloudClient.getConfig();

  return {
    configured: !!config,
    bucketName: config?.voucherBucketName || 'NOT SET',
    projectId: config?.projectId || 'NOT SET',
    hasCredentials: !!config?.credentials,
  };
}

@Get('debug/test-file/:fileName')
async debugTestFile(@Param('fileName') fileName: string) {
  try {
    const exists = await this.cloudStorageService.fileExists(fileName);

    if (!exists) {
      return {
        exists: false,
        message: `File ${fileName} does not exist`
      };
    }

    const signedUrl = await this.cloudStorageService.getSignedUrl(fileName, {
      expiresInMinutes: 5,
      action: 'read',
    });

    return {
      exists: true,
      fileName,
      signedUrl,
      message: 'URL generated successfully'
    };
  } catch (error) {
    return {
      error: true,
      message: error.message,
      stack: error.stack,
    };
  }
}
```

Usar:
```bash
# Verificar configuración
curl http://localhost:3000/vouchers/debug/storage-config

# Probar archivo específico
curl http://localhost:3000/vouchers/debug/test-file/p-2024-10-03_14-30-00-abc123.jpg
```

---

## Referencias

- [Google Cloud Storage - Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Service Account Permissions](https://cloud.google.com/storage/docs/access-control/iam-permissions)
- [CORS Configuration](https://cloud.google.com/storage/docs/configuring-cors)
