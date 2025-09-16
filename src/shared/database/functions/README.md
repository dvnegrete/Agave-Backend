# Funciones de Base de Datos - Detección de Duplicados

Esta carpeta contiene las funciones SQL para la detección automática de duplicados en transacciones bancarias a nivel de base de datos.

## Archivos

### `duplicate_detection.sql`
Contiene la función principal `check_transaction_duplicate()` y el trigger `trigger_check_transaction_duplicate` que implementa las reglas de negocio para evitar inserciones duplicadas.

### `install_duplicate_detection.sql`
Script de instalación que aplica la función y trigger a la base de datos, incluyendo verificaciones de que fueron creados correctamente.

### `test_duplicate_detection.sql`
Suite de pruebas para validar el funcionamiento correcto de la detección de duplicados.

## Reglas de Negocio Implementadas

1. **Fecha más reciente**: Cualquier registro debe tener una fecha igual o posterior al último registro en `last_transaction_bank`
2. **Verificación de banco**: Si el `bank_name` es diferente al último registro, se permiten todas las inserciones
3. **Comparación en mismo día**: Cuando la fecha es igual al último registro, se hace comparación profunda
4. **Detección de duplicados**: Un registro es duplicado cuando TODOS estos campos son exactamente iguales:
   - `date`
   - `time`
   - `concept`
   - `amount`
   - `bank_name`

## Instalación

```sql
-- Ejecutar en la base de datos
\i src/shared/database/functions/install_duplicate_detection.sql
```

## Pruebas

```sql
-- Ejecutar las pruebas
\i src/shared/database/functions/test_duplicate_detection.sql
```

## Comportamiento

- **Permitir inserción**: Si no hay registros previos, banco diferente, fecha posterior, o no es duplicado exacto
- **Ignorar inserción**: Si es fecha anterior al último registro o es duplicado exacto (todos los campos iguales)
- **Silencioso**: Los duplicados se ignoran sin generar errores, usando `RETURN NULL`
- **Logging**: Se registran mensajes informativos con `RAISE NOTICE` para seguimiento
- **Continuidad**: Las operaciones por lotes continúan procesando registros válidos aunque haya duplicados

## Integración con Backend

Una vez implementado este sistema SQL, el backend puede simplificar su lógica de detección de duplicados ya que la base de datos manejará automáticamente estas validaciones mediante el trigger.