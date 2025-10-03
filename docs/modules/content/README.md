# 📚 Sistema de Contenido Centralizado

Este directorio contiene **todos los mensajes, prompts y configuración** de la aplicación en un solo lugar centralizado con **type-safety completo**.

## 📁 Estructura

```
src/shared/content/
├── messages/              # Todos los mensajes de la app
│   ├── types.ts          # Tipos compartidos
│   ├── whatsapp/         # Mensajes de WhatsApp
│   │   ├── greeting.messages.ts
│   │   ├── confirmation.messages.ts
│   │   ├── errors.messages.ts
│   │   ├── contextual.messages.ts
│   │   ├── off-topic.messages.ts
│   │   └── index.ts
│   ├── transactions-bank/ # Mensajes de transacciones bancarias
│   │   ├── success.messages.ts
│   │   ├── errors.messages.ts
│   │   ├── validation.messages.ts
│   │   ├── warnings.messages.ts
│   │   └── index.ts
│   └── index.ts
├── prompts/              # Todos los prompts de IA
│   ├── ai/
│   │   ├── message-classifier.prompt.ts
│   │   ├── ocr-extractor.prompt.ts
│   │   └── index.ts
│   └── index.ts
├── config/               # URLs y constantes de negocio
│   ├── urls.config.ts
│   ├── business-values.config.ts
│   └── index.ts
├── index.ts             # Punto único de exportación
└── README.md            # Este archivo
```

## 🚀 Uso

### Importación Centralizada

```typescript
import {
  // Mensajes de WhatsApp
  GreetingMessages,
  ConfirmationMessages,
  ErrorMessages,
  ContextualMessages,
  OffTopicMessages,

  // Mensajes de Transacciones Bancarias
  TransactionsBankSuccessMessages,
  TransactionsBankErrorMessages,
  TransactionsBankValidationMessages,
  TransactionsBankWarningMessages,

  // Prompts
  MessageClassifierPrompt,
  OCRExtractorPrompt,

  // Configuración
  URLs,
  BusinessValues,

  // Tipos
  VoucherData,
  ConfirmationData,
} from '@/shared/content';
```

## 📝 Ejemplos de Uso

### Mensajes de WhatsApp

```typescript
// Saludo simple
await sendWhatsAppMessage(phoneNumber, GreetingMessages.initial);
// → "¡Hola! Envíame tu comprobante de pago como imagen o PDF para procesarlo."

// Mensaje de confirmación con datos
const confirmationData = {
  casa: 45,
  monto: '123.45',
  fecha_pago: '2025-10-02',
  referencia: 'REF123',
  hora_transaccion: '14:30:00',
};
await sendWhatsAppMessage(
  phoneNumber,
  ConfirmationMessages.success(confirmationData)
);
// → "¡Perfecto! Tu pago ha sido registrado exitosamente..."

// Error de archivo no soportado
await sendWhatsAppMessage(
  phoneNumber,
  ErrorMessages.unsupportedFileType('video/mp4')
);
// → "El tipo de archivo video/mp4 no es soportado..."

// Redirección al portal web
await sendWhatsAppMessage(
  phoneNumber,
  OffTopicMessages.paymentsInfo(URLs.portalWeb)
);
// → "Para consultar información sobre tus pagos... https://agave1.up.railway.app"
```

### Mensajes de Transacciones Bancarias

```typescript
// Mensaje de éxito
return {
  message: TransactionsBankSuccessMessages.fileProcessed,
  ...result,
};
// → "Archivo de transacciones bancarias procesado exitosamente"

// Mensaje de error con detalles
throw new BadRequestException(
  TransactionsBankErrorMessages.fileProcessingErrorDetail(error.message)
);
// → "Error al procesar el archivo: [mensaje de error]"

// Validación de campo
errors.push(TransactionsBankValidationMessages.date.required);
// → "Fecha es requerida"

errors.push(TransactionsBankValidationMessages.amount.belowMinimum(0.01));
// → "El monto mínimo es 0.01"

// Advertencia de negocio
warnings.push(TransactionsBankWarningMessages.highDeposit);
// → "Depósito de monto alto detectado"
```

### Prompts de IA

```typescript
// Clasificar mensaje de WhatsApp
const prompt = MessageClassifierPrompt.build(messageText);
const response = await vertexAI.processTextWithPrompt('', prompt);

// Extraer datos de comprobante
const prompt = OCRExtractorPrompt.buildDefault(extractedText);
const structuredData = await openAI.processTextWithPrompt('', prompt);
```

### Configuración

```typescript
// URLs
const portalUrl = URLs.portalWeb;
// → 'https://agave1.up.railway.app'

// Valores de negocio
const minCasa = BusinessValues.houses.min; // → 1
const maxCasa = BusinessValues.houses.max; // → 66
const sessionTimeout = BusinessValues.session.timeoutMs; // → 600000 (10 min)
const maxFileSize = BusinessValues.files.maxSizeBytes; // → 10485760 (10MB)

// Transacciones bancarias
const maxAmount = BusinessValues.transactionsBank.maxAmount; // → 10000000
const minAmount = BusinessValues.transactionsBank.minAmount; // → 0.01
const supportedCurrencies = BusinessValues.transactionsBank.supportedCurrencies;
// → ['MXN', 'USD', 'EUR', 'CAD']
const depositThreshold = BusinessValues.transactionsBank.highAmountThresholds.deposit;
// → 100000
```

## 🎯 Ventajas

### ✅ Type-Safety Completo
- Autocomplete en el IDE
- Detección de errores en tiempo de compilación
- Refactoring seguro

### ✅ Centralización
- Un solo lugar para buscar y editar mensajes
- Cambios centralizados se reflejan en toda la app
- Fácil auditoría de contenido

### ✅ Organización Modular
- Mensajes agrupados por contexto
- Prompts separados por función
- Configuración aislada

### ✅ Mantenibilidad
- Fácil encontrar y actualizar mensajes
- Sin duplicación de código
- Versionado claro

## 📌 Convenciones

### Nombres de Archivos
- `*.messages.ts` - Mensajes de usuario
- `*.prompt.ts` - Prompts de IA
- `*.config.ts` - Configuración
- `index.ts` - Re-exportaciones

### Estructura de Mensajes
```typescript
export const NombreMessages = {
  /**
   * Descripción del mensaje
   */
  nombreMensaje: 'Mensaje simple',

  /**
   * Descripción del mensaje con parámetros
   */
  conParametros: (param: string) => `Mensaje con ${param}`,
} as const;
```

### Estructura de Prompts
```typescript
export class NombrePrompt {
  /**
   * Descripción del prompt
   * @param param Descripción del parámetro
   * @returns Prompt completo para la IA
   */
  static build(param: string): string {
    return `Prompt template con ${param}`;
  }
}
```

## 🔄 Cómo Agregar Nuevo Contenido

### Nuevo Mensaje

1. Identifica la categoría (WhatsApp, Voucher, etc.)
2. Agrega al archivo correspondiente en `messages/`
3. Exporta desde `index.ts`
4. Usa con type-safety completo

```typescript
// messages/whatsapp/greeting.messages.ts
export const GreetingMessages = {
  // ... mensajes existentes

  /**
   * Nuevo mensaje de despedida
   */
  goodbye: '¡Hasta pronto! Si necesitas ayuda, escríbeme.',
} as const;
```

### Nuevo Prompt

1. Crea el archivo en `prompts/ai/`
2. Usa la clase estática con método `build()`
3. Exporta desde `index.ts`

```typescript
// prompts/ai/new-feature.prompt.ts
export class NewFeaturePrompt {
  static build(input: string): string {
    return `Prompt template...`;
  }
}
```

### Nueva Configuración

1. Agrega a `config/business-values.config.ts` o `urls.config.ts`
2. Usa `as const` para inmutabilidad
3. Exporta desde `index.ts`

```typescript
// config/business-values.config.ts
export const BusinessValues = {
  // ... valores existentes

  newFeature: {
    limit: 100,
    enabled: true,
  },
} as const;
```

## 🔍 Búsqueda Rápida

### Encontrar un Mensaje
```bash
# Buscar por texto
grep -r "comprobante de pago" src/shared/content/messages/

# Buscar por uso
grep -r "GreetingMessages.initial" src/
```

### Ver Todos los Mensajes de WhatsApp
```typescript
// src/shared/content/messages/whatsapp/index.ts
```

### Ver Todos los Prompts
```typescript
// src/shared/content/prompts/index.ts
```

## ⚙️ Testing

```typescript
import { ConfirmationMessages } from '@/shared/content';

describe('ConfirmationMessages', () => {
  it('should generate success message with data', () => {
    const data = {
      casa: 45,
      monto: '123.45',
      fecha_pago: '2025-10-02',
      referencia: 'REF123',
      hora_transaccion: '14:30:00',
    };

    const message = ConfirmationMessages.success(data);

    expect(message).toContain('Casa: 45');
    expect(message).toContain('Monto: 123.45');
  });
});
```

## 📚 Referencias

- [TypeScript Const Assertions](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions)
- [Static Factory Methods](https://refactoring.guru/design-patterns/factory-method)

---

**Mantenido por:** Equipo de Desarrollo Agave
**Última actualización:** Octubre 2025
