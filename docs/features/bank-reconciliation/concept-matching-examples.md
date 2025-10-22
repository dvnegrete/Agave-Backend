# Ejemplos de Concept Matching

## Ejemplos de Conceptos Reales Soportados

### ✅ Ejemplos que funcionan automáticamente

#### Patrón Simple
```
Concepto: "Pago casa 5"
Resultado: Casa 5 extraída (HIGH confidence)
Método: Regex
```

#### Con Mes
```
Concepto: "Casa 5 enero mantenimiento"
Resultado:
  - Casa: 5 (HIGH confidence)
  - Mes: 1 (enero)
  - Tipo: mantenimiento
Método: Regex
```

#### Abreviatura Corta
```
Concepto: "c50 febrero"
Resultado: Casa 50 extraída (HIGH confidence)
Método: Regex
```

#### Abreviatura con Guión
```
Concepto: "Pago c-1 agua"
Resultado: Casa 1 extraída (HIGH confidence)
Método: Regex
```

#### Variante cs
```
Concepto: "cs02 cuota administración"
Resultado: Casa 2 extraída (MEDIUM confidence)
Método: Regex
```

#### Apartamento
```
Concepto: "apto 15 luz marzo"
Resultado:
  - Casa: 15 (HIGH confidence)
  - Mes: 3 (marzo)
  - Tipo: luz
Método: Regex
```

#### Apartamento Abreviado
```
Concepto: "apt #64 pago"
Resultado: Casa 64 extraída (HIGH confidence)
Método: Regex
```

#### Con Monto
```
Concepto: "Casa 5 mantenimiento $250.00"
Resultado: Casa 5 extraída (HIGH confidence)
Método: Regex
```

#### Multiple Keywords
```
Concepto: "Condominio casa 22 cuota mensual enero"
Resultado:
  - Casa: 22 (HIGH confidence)
  - Mes: 1 (enero)
  - Tipo: condominio
Método: Regex
```

---

### 🤖 Ejemplos que requieren IA

#### Concepto Ambiguo
```
Concepto: "Pago para propiedad zona norte"
Resultado: Casa identificada por IA (MEDIUM confidence)
Método: OpenAI/Vertex AI
Nota: Regex no puede extraer, IA deduce del contexto
```

#### Lenguaje Natural
```
Concepto: "Transferencia inmueble número cinco"
Resultado: Casa 5 identificada (MEDIUM confidence)
Método: OpenAI/Vertex AI
Nota: IA traduce "número cinco" → 5
```

#### Forma Numérica No Estándar
```
Concepto: "Propiedad 10 administración"
Resultado: Casa 10 identificada (MEDIUM-LOW confidence)
Método: OpenAI/Vertex AI
Nota: Podría ser ambiguo, IA valida en contexto
```

#### Con Información Dispersa
```
Concepto: "Agua enero pago inmueble cinco"
Resultado:
  - Casa: 5 (MEDIUM confidence)
  - Mes: 1
  - Tipo: agua
Método: OpenAI/Vertex AI
Nota: Información dispersa, IA reorganiza
```

---

### ⚠️ Ejemplos Conflictivos (Requieren Revisión Manual)

#### Conflicto Concepto-Centavos
```
Concepto: "Casa 10 pago"
Monto: $150.05 (05 centavos = Casa 5)

Resultado: CONFLICTO
Razón: "Concepto sugiere casa 10, pero centavos sugieren 5"
Acción: Marcada para revisión manual
```

#### Múltiples Números
```
Concepto: "Pago casa 5 y 10 mantenimiento"
Monto: $200.00

Resultado: Casa 5 extraída (toma la primera)
Nota: Podría haber sido 10, requiere revisión
```

#### Número Inválido
```
Concepto: "Pago casa 100"
Monto: $150.00

Resultado: Rechazado (casa 100 > máximo 66)
Acción: Marcada para revisión manual
```

#### Sin Información
```
Concepto: "Transferencia bancaria"
Monto: $200.00

Resultado: No identificada
Acción: Requiere voucher u otros medios
```

---

## Patrones Respaldados

### Casa Explícita

| Patrón | Ejemplo | Confianza | Notas |
|--------|---------|-----------|-------|
| Casa N | "Casa 5" | HIGH | Standard |
| Casa #N | "Casa #50" | HIGH | Con numeral |
| Casa-N | "Casa-1" | HIGH | Con guión |
| CASA N | "CASA 64" | HIGH | Case-insensitive |
| Casa N, | "Casa 5, enero" | HIGH | Con puntuación |

### Abreviaturas

| Patrón | Ejemplo | Confianza | Notas |
|--------|---------|-----------|-------|
| cN | "c5" | HIGH | Sin espacio |
| c N | "c 5" | HIGH | Con espacio |
| c-N | "c-50" | HIGH | Con guión |
| cN | "c50" | HIGH | Dos dígitos |
| csN | "cs02" | MEDIUM | Variante cs |
| cs-N | "cs-10" | MEDIUM | Variante con guión |

### Apartados

| Patrón | Ejemplo | Confianza | Notas |
|--------|---------|-----------|-------|
| apto N | "apto 5" | HIGH | Completo |
| apt N | "apt 15" | HIGH | Abreviado |
| apart. N | "apart. 22" | HIGH | Punto |
| apto #N | "apto #30" | HIGH | Con numeral |

### Otros

| Patrón | Ejemplo | Confianza | Notas |
|--------|---------|-----------|-------|
| lote N | "lote 5" | MEDIUM | Identificador |
| manzana N | "manzana 10" | MEDIUM | Block |
| propiedad N | "propiedad 25" | MEDIUM | Genérico |

---

## Meses Soportados

| Español | Número | Ejemplo |
|---------|--------|---------|
| enero | 1 | "Casa 5 enero" |
| febrero | 2 | "c50 febrero" |
| marzo | 3 | "apto 10 marzo" |
| abril | 4 | "Casa 5 abril" |
| mayo | 5 | "c10 mayo" |
| junio | 6 | "Casa 20 junio" |
| julio | 7 | "apto 5 julio" |
| agosto | 8 | "Casa 30 agosto" |
| septiembre | 9 | "c15 septiembre" |
| octubre | 10 | "apto 25 octubre" |
| noviembre | 11 | "Casa 10 noviembre" |
| diciembre | 12 | "c5 diciembre" |

También soporta:
- Números: "mes 3", "mes 03", "3"
- Abreviaturas: "ene", "feb", etc. (si IA lo reconoce)

---

## Tipos de Pago Reconocidos

```
mantenimiento      → Cuota de mantenimiento
agua               → Pago de agua
luz                → Pago de luz/energía
cuota              → Cuota general
administración     → Cuota administrativa
renta              → Pago de renta
arriendo           → Pago de arriendo
servicios          → Servicios varios
expensas           → Expensas comunes
condominio         → Cuota de condominio
piscina            → Acceso/cuota de piscina
estacionamiento    → Estacionamiento
parqueadero        → Parqueadero/garaje
basura             → Recolección de basura
reserva            → Fondo de reserva
fondo              → Fondo de reserva
seguro             → Seguro
impuesto           → Impuesto/predial
```

---

## Flujos de Decisión

### Flujo 1: Regex Exitoso (Alta Confianza)

```
Concepto: "Casa 5 enero"
    ↓
Regex: Encuentra "Casa 5"
    ├─ Confianza: HIGH
    ├─ Casa 5
    ├─ Mes: enero (1)
    └─ Extrae: agua (si lo hay)
    ↓
MIN_CONFIDENCE = medium
    ↓
HIGH >= medium?
    ├─ SÍ → Usar Casa 5
    └─ CONCILIADA (sin revisión)
```

### Flujo 2: Regex Ambiguo (Baja Confianza)

```
Concepto: "Propiedad zona norte"
    ↓
Regex: No encuentra patrón claro
    ├─ Confianza: NONE
    └─ IA Analysis Enabled?
        ├─ SÍ → Llamar IA (OpenAI)
        └─ NO → Usar centavos
    ↓
OpenAI → Casa 5 (MEDIUM confidence)
    ↓
MIN_CONFIDENCE = medium
    ↓
MEDIUM >= medium?
    ├─ SÍ → Usar Casa 5
    ├─ Centavos coinciden?
    │   ├─ SÍ → CONCILIADA (sin revisión)
    │   └─ NO → CONCILIADA (con revisión por conflicto)
    └─ NO → Usar centavos
```

### Flujo 3: Conflicto Concepto-Centavos

```
Concepto: "Casa 10"
Monto: $150.05 (centavos = 5)
    ↓
Concept Casa: 10
Cents Casa: 5
    ↓
10 ≠ 5
    ├─ Conflicto detectado
    ├─ Usar Casa 10 (del concepto)
    └─ Marcar para REVISIÓN MANUAL
    ↓
Razón: "Conflicto: concepto sugiere casa 10,
        pero centavos sugieren 5"
```

---

## Pruebas Locales

### Test Básico

```typescript
const extractor = new ConceptHouseExtractorService();

// Caso 1: Simple
const result1 = extractor.extractHouseNumber("Casa 5");
console.log(result1);
// {
//   houseNumber: 5,
//   confidence: 'high',
//   method: 'regex',
//   patternName: 'casa_numero',
//   reason: "Patrón 'casa_numero' coincidió: \"Casa 5\""
// }

// Caso 2: Con mes
const result2 = extractor.extractHouseNumber("c50 febrero");
console.log(result2);
// {
//   houseNumber: 50,
//   confidence: 'high',
//   method: 'regex',
//   patternName: 'c_abbreviation',
//   month: {
//     monthNumber: 2,
//     monthName: 'Febrero',
//     reason: "Mes 'febrero' encontrado en el concepto"
//   }
// }

// Caso 3: Sin coincidencia
const result3 = extractor.extractHouseNumber("Transferencia general");
console.log(result3);
// {
//   houseNumber: null,
//   confidence: 'none',
//   method: 'none',
//   reason: 'No se encontró patrón de número de casa en el concepto'
// }
```

### Test con IA

```typescript
const analyzer = new ConceptAnalyzerService(openAIService, vertexAIService);

const result = await analyzer.analyzeConceptWithAI({
  concept: "Pago para propiedad zona norte",
  amount: 250.00,
  houseNumberRange: { min: 1, max: 66 }
});

console.log(result);
// {
//   houseNumber: 5,
//   confidence: 'medium',
//   method: 'ai',
//   reason: 'IA dedujo que "zona norte" corresponde a casa 5',
//   month: undefined,
//   paymentType: undefined
// }
```

---

## Configuración Recomendada por Caso de Uso

### Caso 1: Máxima Automatización

Para negocios que confían en que los usuarios indicarán bien el número:

```typescript
ENABLE_CONCEPT_MATCHING: true,
CONCEPT_MATCHING_MIN_CONFIDENCE: 'low',
ENABLE_AI_CONCEPT_ANALYSIS: true,
```

**Resultado**: 98%+ automáticas, 2% revisión

### Caso 2: Balanceado (Recomendado)

Para la mayoría de casos:

```typescript
ENABLE_CONCEPT_MATCHING: true,
CONCEPT_MATCHING_MIN_CONFIDENCE: 'medium',
ENABLE_AI_CONCEPT_ANALYSIS: true,
```

**Resultado**: 95%+ automáticas, 5% revisión

### Caso 3: Conservador

Para máxima precisión:

```typescript
ENABLE_CONCEPT_MATCHING: true,
CONCEPT_MATCHING_MIN_CONFIDENCE: 'high',
ENABLE_AI_CONCEPT_ANALYSIS: false,
```

**Resultado**: 85%+ automáticas, 15% revisión

### Caso 4: Solo Regex (Sin IA)

Para testing o ambientes sin acceso a IA:

```typescript
ENABLE_CONCEPT_MATCHING: true,
CONCEPT_MATCHING_MIN_CONFIDENCE: 'medium',
ENABLE_AI_CONCEPT_ANALYSIS: false,
```

**Resultado**: 80%+ automáticas, 20% revisión

---

## Troubleshooting

### Q: ¿Por qué mi concepto no se está reconociendo?

**A**: Verifica:
1. ¿El concepto está vacío?
2. ¿El número está fuera de rango (1-66)?
3. ¿Está habilitado `ENABLE_CONCEPT_MATCHING`?
4. ¿El patrón es muy diferente a los ejemplos?
   - Si es caso ambiguo, habilita `ENABLE_AI_CONCEPT_ANALYSIS`

### Q: ¿Por qué se marca como conflicto?

**A**: Cuando:
- Concepto sugiere Casa 10
- Centavos sugieren Casa 5
- Se marca para revisión manual
- Verifica ambas fuentes manualmente

### Q: ¿La IA está haciendo llamadas innecesarias?

**A**: Optimiza:
1. Sube `CONCEPT_MATCHING_MIN_CONFIDENCE` a 'high'
2. Deshabilita `ENABLE_AI_CONCEPT_ANALYSIS` si no la necesitas
3. Usa solo regex si los conceptos son claros

### Q: ¿Cómo veo los logs?

**A**: Busca en logs:
```
[ConceptHouseExtractorService]
[ConceptAnalyzerService]
[MatchingService]
```

---

## Próximos Pasos

1. **Habilitar en Producción**:
   ```typescript
   ENABLE_CONCEPT_MATCHING: true
   ```

2. **Monitorear Resultados**:
   - Tasa de conciliación automática
   - Tasa de conflictos detectados
   - Casos que requieren revisión manual

3. **Ajustar Confianza Según Datos**:
   - Si hay muchos falsos positivos: sube a 'high'
   - Si hay muchos rechazos: baja a 'low'

4. **Feedback Loop**:
   - Analizar casos que fallaron
   - Agregar nuevos patrones si es necesario
   - Mejorar prompts de IA según resultados
