import { Injectable, Logger } from '@nestjs/common';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { ReconciliationConfig } from '../../config/reconciliation.config';
import {
  getDateDifferenceInHours,
  extractHouseNumberFromCents,
} from '@/shared/common/utils';
import {
  ReconciliationMatch,
  SurplusTransaction,
  ManualValidationCase,
  ConfidenceLevel,
  MatchCriteria,
} from '../../domain';
import { ConceptHouseExtractorService } from './concept-house-extractor.service';
import { ConceptAnalyzerService } from './concept-analyzer.service';

export type MatchResult =
  | { type: 'matched'; match: ReconciliationMatch; voucherId: number; voucher: Voucher }
  | { type: 'surplus'; surplus: SurplusTransaction }
  | { type: 'manual'; case: ManualValidationCase };

/**
 * Servicio de infraestructura para matching de transacciones con vouchers
 * Implementa la lógica de coincidencias basada en reglas de negocio
 *
 * Estrategia de matching:
 * 1. AMOUNT + DATE: Monto exacto + fecha cercana
 * 2. CONCEPT: Análisis del concepto para extraer número de casa
 * 3. CENTS: Identificación por centavos del monto
 * 4. MANUAL: Requiere revisión humana si hay ambigüedad
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly conceptExtractorService: ConceptHouseExtractorService,
    private readonly conceptAnalyzerService: ConceptAnalyzerService,
  ) {}
  /**
   * Intenta encontrar coincidencias para una transacción bancaria
   * Soporta tanto matching sincrónico (amount/date) como asincrónico (concept/IA)
   */
  async matchTransaction(
    transaction: TransactionBank,
    availableVouchers: Voucher[],
    processedVoucherIds: Set<number>,
  ): Promise<MatchResult> {
    // 1. Buscar coincidencias por monto exacto
    const amountMatches = this.filterByAmount(
      transaction,
      availableVouchers,
      processedVoucherIds,
    );

    // Si hay una sola coincidencia por monto, conciliar automáticamente
    if (amountMatches.length === 1) {
      return this.createSingleMatch(transaction, amountMatches[0]);
    }

    // Si hay múltiples coincidencias, filtrar por fecha
    if (amountMatches.length > 1) {
      return await this.resolveMultipleMatches(transaction, amountMatches);
    }

    // No hay coincidencias con vouchers, intentar identificar por concepto/centavos
    return await this.handleNoVoucherMatch(transaction);
  }

  /**
   * Filtra vouchers por monto exacto
   */
  private filterByAmount(
    transaction: TransactionBank,
    vouchers: Voucher[],
    processedIds: Set<number>,
  ): Voucher[] {
    return vouchers.filter(
      (v) =>
        Math.abs(v.amount - transaction.amount) < 0.01 &&
        !processedIds.has(v.id),
    );
  }

  /**
   * Crea un match cuando hay una sola coincidencia
   */
  private createSingleMatch(
    transaction: TransactionBank,
    voucher: Voucher,
  ): MatchResult {
    const dateDiff = getDateDifferenceInHours(
      transaction.date,
      transaction.time,
      voucher.date,
    );

    const houseNumber = extractHouseNumberFromCents(transaction.amount);

    const match = ReconciliationMatch.create({
      transaction,
      voucher,
      houseNumber,
      matchCriteria: [MatchCriteria.AMOUNT],
      confidenceLevel: ConfidenceLevel.HIGH,
      dateDifferenceHours: dateDiff,
    });

    return { type: 'matched', match, voucherId: voucher.id, voucher };
  }

  /**
   * Resuelve el caso de múltiples coincidencias por monto
   */
  private async resolveMultipleMatches(
    transaction: TransactionBank,
    matches: Voucher[],
  ): Promise<MatchResult> {
    // Calcular diferencias de fecha y ordenar por más cercano
    const matchesWithDateDiff = matches
      .map((voucher) => ({
        voucher,
        dateDiff: getDateDifferenceInHours(
          transaction.date,
          transaction.time,
          voucher.date,
        ),
      }))
      .filter((m) => m.dateDiff <= ReconciliationConfig.DATE_TOLERANCE_HOURS)
      .sort((a, b) => a.dateDiff - b.dateDiff);

    // Si hay una sola coincidencia dentro de tolerancia de fecha
    if (matchesWithDateDiff.length === 1) {
      const { voucher, dateDiff } = matchesWithDateDiff[0];
      const houseNumber = extractHouseNumberFromCents(transaction.amount);

      const match = ReconciliationMatch.create({
        transaction,
        voucher,
        houseNumber,
        matchCriteria: [MatchCriteria.AMOUNT, MatchCriteria.DATE],
        confidenceLevel: ConfidenceLevel.HIGH,
        dateDifferenceHours: dateDiff,
      });

      return { type: 'matched', match, voucherId: voucher.id, voucher };
    }

    // Múltiples coincidencias aún → validación manual
    if (matchesWithDateDiff.length > 1) {
      const manualCase = ManualValidationCase.create({
        transaction,
        possibleMatches: matchesWithDateDiff.map((m) => ({
          voucher: m.voucher,
          dateDifferenceHours: m.dateDiff,
          similarityScore:
            1 - m.dateDiff / ReconciliationConfig.DATE_TOLERANCE_HOURS,
        })),
        reason: 'Multiple vouchers with same amount and similar dates',
      });

      return { type: 'manual', case: manualCase };
    }

    // Sin coincidencias dentro de tolerancia
    return await this.handleNoVoucherMatch(transaction);
  }

  /**
   * Maneja el caso donde no hay voucher coincidente
   * Intenta identificar casa por concepto o centavos
   */
  private async handleNoVoucherMatch(transaction: TransactionBank): Promise<MatchResult> {
    const houseNumberFromCents = extractHouseNumberFromCents(transaction.amount);
    let houseNumberFromConcept: number | null = null;
    let conceptConfidence: 'high' | 'medium' | 'low' | 'none' = 'none';

    // 1. Intentar extraer número de casa del concepto
    if (ReconciliationConfig.ENABLE_CONCEPT_MATCHING && transaction.concept) {
      try {
        // Primero intentar con regex (rápido y sin IA)
        const extractionResult = this.conceptExtractorService.extractHouseNumber(
          transaction.concept,
        );

        houseNumberFromConcept = extractionResult.houseNumber;
        conceptConfidence = extractionResult.confidence;

        // Si el patrón regex no es conclusivo, intentar con IA
        if (
          conceptConfidence === 'low' ||
          conceptConfidence === 'none' ||
          houseNumberFromConcept === null
        ) {
          if (ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS) {
            try {
              this.logger.debug(`Usando IA para analizar concepto: "${transaction.concept}"`);
              const aiResult = await this.conceptAnalyzerService.analyzeConceptWithAI({
                concept: transaction.concept,
                amount: transaction.amount,
                houseNumberRange: {
                  min: 1,
                  max: ReconciliationConfig.MAX_HOUSE_NUMBER,
                },
              });

              if (aiResult.houseNumber !== null) {
                houseNumberFromConcept = aiResult.houseNumber;
                conceptConfidence = aiResult.confidence;
              }
            } catch (error) {
              this.logger.warn(
                `Error al analizar concepto con IA: ${error instanceof Error ? error.message : 'Unknown'}`,
              );
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Error al extraer número de concepto: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    // 2. Validación cruzada: SOLO se concilia automáticamente si hay coincidencia de dos fuentes
    // REGLA FUNDAMENTAL: Sin voucher + sin validación cruzada = NO se concilia automáticamente

    // 2a. Si tenemos AMBAS fuentes: concepto + centavos
    if (houseNumberFromConcept && houseNumberFromCents > 0) {
      if (houseNumberFromConcept === houseNumberFromCents) {
        // ✅ CORRECTO: Las dos fuentes coinciden → conciliada automáticamente
        this.logger.debug(
          `Casa ${houseNumberFromConcept} confirmada por validación cruzada: concepto + centavos coinciden`,
        );

        const surplus = SurplusTransaction.fromTransaction(
          transaction,
          `No voucher found, but house ${houseNumberFromConcept} confirmed by cross-validation: concept + cents match (confidence: ${conceptConfidence})`,
          false, // requiresManualReview = false - DOS fuentes coinciden
          houseNumberFromConcept,
        );

        return { type: 'surplus', surplus };
      } else {
        // ⚠️ Conflicto: conceptos y centavos no coinciden → manual review requerido
        this.logger.warn(
          `Conflicto detectado: concepto sugiere casa ${houseNumberFromConcept}, centavos sugieren casa ${houseNumberFromCents}`,
        );

        const surplus = SurplusTransaction.fromTransaction(
          transaction,
          `Conflict: concept suggests house ${houseNumberFromConcept} (confidence: ${conceptConfidence}), but cents suggest house ${houseNumberFromCents}. Manual review required.`,
          true, // requiresManualReview = true - CONFLICTO
          houseNumberFromConcept, // Usar concepto como principal
        );

        return { type: 'surplus', surplus };
      }
    }

    // 2b. Si SOLO tenemos centavos válidos (sin concepto o concepto no concluyente)
    if (houseNumberFromCents > 0 && houseNumberFromCents <= ReconciliationConfig.MAX_HOUSE_NUMBER) {
      // ✅ Una fuente válida, pero limitada
      this.logger.debug(
        `Casa ${houseNumberFromCents} identificada SOLO por centavos. Requiere revisión por falta de concepto.`,
      );

      const surplus = SurplusTransaction.fromTransaction(
        transaction,
        `No voucher found. House ${houseNumberFromCents} identified ONLY by cents. Requires manual review (no concept validation).`,
        true, // requiresManualReview = true - UNA SOLA FUENTE
        houseNumberFromCents,
      );

      return { type: 'surplus', surplus };
    }

    // 2c. Si SOLO tenemos concepto (sin centavos válidos para validar cruzada)
    if (houseNumberFromConcept && houseNumberFromCents === 0) {
      // ❌ NO CONCILIABLE: Concepto sin validación cruzada
      this.logger.warn(
        `Casa ${houseNumberFromConcept} extraída del concepto, pero NO se concilia (sin centavos para validación cruzada).`,
      );

      const surplus = SurplusTransaction.fromTransaction(
        transaction,
        `No voucher found. House ${houseNumberFromConcept} identified by concept (${conceptConfidence} confidence) but NO cents validation. Cannot auto-reconcile. Requires manual review.`,
        true, // requiresManualReview = true - SIN SEGUNDA FUENTE
        houseNumberFromConcept,
      );

      return { type: 'surplus', surplus };
    }

    // 2d. Sin ninguna información confiable
    const reason = ReconciliationConfig.REQUIRE_VOUCHER_FOR_NO_CENTS
      ? 'No voucher found and no valid house identifier (voucher required). Concept analysis failed.'
      : 'No voucher found and no house identifier available';

    const surplus = SurplusTransaction.fromTransaction(transaction, reason, true, 0);

    return { type: 'surplus', surplus };
  }
}
