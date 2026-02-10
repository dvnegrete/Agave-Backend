import { Injectable, Logger } from '@nestjs/common';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { ReconciliationConfig } from '../../config/reconciliation.config';
import {
  getDateDifferenceInHours,
  extractHouseNumberFromCents,
} from '@/shared/common/utils';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';
import {
  ReconciliationMatch,
  UnclaimedDeposit,
  ManualValidationCase,
  ConfidenceLevel,
  MatchCriteria,
  ConceptResult,
} from '../../domain';
import { ConceptHouseExtractorService } from './concept-house-extractor.service';
import { ConceptAnalyzerService } from './concept-analyzer.service';

export type MatchResult =
  | {
      type: 'matched';
      match: ReconciliationMatch;
      voucherId: number;
      voucher: Voucher;
    }
  | { type: 'surplus'; surplus: UnclaimedDeposit }
  | { type: 'manual'; case: ManualValidationCase };

/**
 * Servicio de infraestructura para matching de transacciones con vouchers
 * Implementa la lógica de coincidencias basada en reglas de negocio
 *
 * Estrategia de matching:
 * 1. AMOUNT + DATE: Monto exacto + fecha cercana
 *    - Si 2+ vouchers con similaridad muy cercana (<5% diff) → MANUAL VALIDATION
 *    - Si hay claro ganador → usa voucher más cercano en fecha
 * 2. CENTS: Los centavos son suficientes para conciliar automáticamente
 *    - EXCEPTO cuando hay conflicto con concepto → depósito no reclamado
 * 3. CONCEPT: Solo si concepto tiene alta confianza y no hay centavos
 * 4. MANUAL: Requiere revisión humana cuando:
 *    - Múltiples vouchers con similaridad muy cercana
 * 5. UNCLAIMED: Transacciones sin voucher coincidente pero con información identificable
 *    - Por centavos, por concepto, o con conflicto entre fuentes
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

    // ✅ CAMBIO: PRIMERO intentar extraer casa del voucher (mayor prioridad)
    let houseNumber = this.extractHouseNumberFromVoucher(voucher);

    // Si el voucher no tiene casa, usar centavos de la transaction
    if (!houseNumber) {
      houseNumber = extractHouseNumberFromCents(transaction.amount);
    }

    if (!this.isValidHouseNumber(houseNumber)) {
      return this.createUnclaimedDepositWithoutInfo(transaction);
    }

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
   * Estrategia:
   * 1. Si los mejores candidatos tienen similitud muy cercana (<5%) → validación manual
   * 2. Si hay un claro ganador → auto-conciliar con el más cercano en fecha
   * 3. Si ninguno está dentro de tolerancia → sin coincidencias
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

    // Si hay al menos una coincidencia dentro de tolerancia
    if (matchesWithDateDiff.length >= 1) {
      // Discriminación por ratio de tiempo: si hay un claro ganador por cercanía temporal
      if (matchesWithDateDiff.length > 1) {
        const closest = matchesWithDateDiff[0]; // Ya ordenado por dateDiff ASC
        const secondClosest = matchesWithDateDiff[1];

        // Si el más cercano tiene dateDiff=0 y el segundo tiene dateDiff>0 → auto-match
        if (closest.dateDiff === 0 && secondClosest.dateDiff > 0) {
          this.logger.log(
            `Discriminación por tiempo: Voucher ${closest.voucher.id} tiene dateDiff=0, segundo tiene dateDiff=${secondClosest.dateDiff.toFixed(4)}h → auto-match`,
          );
          return this.createSingleMatch(transaction, closest.voucher);
        }

        // Si el ratio (segundo / primero) >= 2 → claro ganador por tiempo
        if (closest.dateDiff > 0) {
          const timeRatio = secondClosest.dateDiff / closest.dateDiff;
          if (timeRatio >= 2) {
            this.logger.log(
              `Discriminación por tiempo: Voucher ${closest.voucher.id} (diff=${closest.dateDiff.toFixed(4)}h) vs Voucher ${secondClosest.voucher.id} (diff=${secondClosest.dateDiff.toFixed(4)}h), ratio=${timeRatio.toFixed(1)}x → auto-match`,
            );
            return this.createSingleMatch(transaction, closest.voucher);
          }
        }
      }

      // Agregar similarity score a cada candidato
      const candidatesWithScores = matchesWithDateDiff.map((m) => ({
        ...m,
        similarity: this.calculateSimilarityScore(m.dateDiff),
      }));

      if (
        ReconciliationConfig.ENABLE_MANUAL_VALIDATION &&
        candidatesWithScores.length > 1
      ) {
        const maxSimilarity = Math.max(
          ...candidatesWithScores.map((c) => c.similarity),
        );
        const minSimilarity = Math.min(
          ...candidatesWithScores.map((c) => c.similarity),
        );
        const similarityDiff = maxSimilarity - minSimilarity;

        // Si la diferencia es menor al umbral (5%) → escalar a validación manual
        if (similarityDiff < ReconciliationConfig.SIMILARITY_THRESHOLD) {
          const manualCase = this.createManualValidationCase(
            transaction,
            candidatesWithScores,
          );

          return { type: 'manual', case: manualCase };
        }
      }

      // Usar el más cercano en fecha (mejor similaridad)
      const { voucher, dateDiff, similarity } = candidatesWithScores[0];

      let houseNumber = this.extractHouseNumberFromVoucher(voucher);
      let matchSource = 'VOUCHER_HOUSE';

      if (!houseNumber) {
        houseNumber = extractHouseNumberFromCents(transaction.amount);
        matchSource = 'TRANSACTION_CENTS';
      }

      if (!this.isValidHouseNumber(houseNumber)) {
        return this.createUnclaimedDepositWithoutInfo(transaction);
      }

      const match = ReconciliationMatch.create({
        transaction,
        voucher,
        houseNumber,
        matchCriteria: [MatchCriteria.AMOUNT, MatchCriteria.DATE],
        confidenceLevel: ConfidenceLevel.HIGH,
        dateDifferenceHours: dateDiff,
      });

      this.logger.log(
        `Múltiples vouchers encontrados, usando el más cercano: Voucher ${voucher.id} (diferencia: ${dateDiff}h, similitud: ${similarity.toFixed(2)}) → Casa ${houseNumber} (fuente: ${matchSource})`,
      );

      return { type: 'matched', match, voucherId: voucher.id, voucher };
    }

    // Sin coincidencias dentro de tolerancia
    return await this.handleNoVoucherMatch(transaction);
  }

  /**
   * Maneja el caso donde no hay voucher coincidente
   *
   * Nueva estrategia simplificada:
   * 1. Centavos válidos → conciliar (excepto si hay conflicto con concepto)
   * 2. Concepto claro sin centavos → conciliar
   * 3. Sin información → depósito no reclamado con revisión manual
   */
  private async handleNoVoucherMatch(
    transaction: TransactionBank,
  ): Promise<MatchResult> {
    const centsHouse = extractHouseNumberFromCents(transaction.amount);
    const conceptResult = await this.extractHouseFromConcept(
      transaction.concept,
    );

    // Estrategia 1: Centavos válidos
    if (this.isValidHouseNumber(centsHouse)) {
      return this.reconcileByCents(transaction, centsHouse, conceptResult);
    }

    // Estrategia 2: Concepto claro (sin centavos)
    if (conceptResult.isHighConfidence()) {
      return this.reconcileByConcept(transaction, conceptResult);
    }

    // Estrategia 3: Sin información suficiente
    return this.createUnclaimedDepositWithoutInfo(transaction);
  }

  /**
   * Concilia usando centavos como fuente principal
   * REGLA: Los centavos son suficientes, excepto cuando hay conflicto con concepto
   */
  private reconcileByCents(
    transaction: TransactionBank,
    centsHouse: number,
    conceptResult: ConceptResult,
  ): MatchResult {
    // Caso: Conflicto entre centavos y concepto
    if (conceptResult.hasHouse() && conceptResult.house !== centsHouse) {
      return this.createConflictUnclaimedDeposit(
        transaction,
        centsHouse,
        conceptResult.house!,
      );
    }

    // Caso: Centavos solos o centavos + concepto coinciden
    const reason = conceptResult.hasHouse()
      ? `Centavos + concepto coinciden (casa ${centsHouse}, confianza: ${conceptResult.confidence})`
      : `Identificado por centavos (casa ${centsHouse})`;

    return this.createAutoReconciled(transaction, centsHouse, reason);
  }

  /**
   * Concilia usando concepto cuando no hay centavos válidos
   * REGLA: Solo si el concepto tiene alta confianza
   */
  private reconcileByConcept(
    transaction: TransactionBank,
    conceptResult: ConceptResult,
  ): MatchResult {
    return this.createAutoReconciled(
      transaction,
      conceptResult.house!,
      `Concepto identifica claramente casa ${conceptResult.house} (confianza: ${conceptResult.confidence})`,
    );
  }

  /**
   * Crea depósito no reclamado auto-conciliado (sin revisión manual)
   */
  private createAutoReconciled(
    transaction: TransactionBank,
    houseNumber: number,
    reason: string,
  ): MatchResult {
    this.logger.log(
      `Casa ${houseNumber} conciliada automáticamente: ${reason}`,
    );

    const unclaimedDeposit = UnclaimedDeposit.fromTransaction(
      transaction,
      `No voucher found. ${reason}`,
      false, // requiresManualReview = false
      houseNumber,
    );

    return { type: 'surplus', surplus: unclaimedDeposit };
  }

  /**
   * Crea depósito no reclamado por conflicto (requiere revisión manual)
   */
  private createConflictUnclaimedDeposit(
    transaction: TransactionBank,
    centsHouse: number,
    conceptHouse: number,
  ): MatchResult {
    this.logger.warn(
      `Conflicto detectado: concepto sugiere casa ${conceptHouse}, centavos sugieren casa ${centsHouse}`,
    );

    const unclaimedDeposit = UnclaimedDeposit.fromTransaction(
      transaction,
      `Conflicto: concepto sugiere casa ${conceptHouse}, centavos sugieren casa ${centsHouse}. Requiere validación manual.`,
      true, // requiresManualReview = true
      centsHouse, // Usar centavos como principal
    );

    return { type: 'surplus', surplus: unclaimedDeposit };
  }

  /**
   * Crea depósito no reclamado sin información suficiente
   */
  private createUnclaimedDepositWithoutInfo(
    transaction: TransactionBank,
  ): MatchResult {
    this.logger.debug(
      'Sin información suficiente para conciliar automáticamente',
    );

    const unclaimedDeposit = UnclaimedDeposit.fromTransaction(
      transaction,
      'Sin voucher, sin centavos válidos, sin concepto identificable',
      true, // requiresManualReview = true
      0,
    );

    return { type: 'surplus', surplus: unclaimedDeposit };
  }

  /**
   * Extrae número de casa del concepto con análisis completo
   * Usa regex primero, fallback a IA si está habilitado
   */
  private async extractHouseFromConcept(
    concept: string | null,
  ): Promise<ConceptResult> {
    if (!concept || !ReconciliationConfig.ENABLE_CONCEPT_MATCHING) {
      return ConceptResult.none();
    }

    try {
      // 1. Intentar con regex (rápido)
      const regexResult =
        this.conceptExtractorService.extractHouseNumber(concept);

      if (regexResult.confidence === 'high') {
        return ConceptResult.from(regexResult);
      }

      // 2. Fallback a IA si está habilitado
      if (ReconciliationConfig.ENABLE_AI_CONCEPT_ANALYSIS) {
        try {
          this.logger.debug(`Usando IA para analizar concepto: "${concept}"`);
          const aiResult =
            await this.conceptAnalyzerService.analyzeConceptWithAI({
              concept,
              amount: 0,
              houseNumberRange: {
                min: MIN_HOUSE_NUMBER,
                max: MAX_HOUSE_NUMBER,
              },
            });

          return ConceptResult.from(aiResult);
        } catch (error) {
          this.logger.warn(
            `Error al analizar concepto con IA: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }
      }

      return ConceptResult.from(regexResult);
    } catch (error) {
      this.logger.warn(
        `Error al extraer número de concepto: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return ConceptResult.none();
    }
  }

  /**
   * Valida si un número de casa es válido
   */
  private isValidHouseNumber(houseNumber: number): boolean {
    return houseNumber >= MIN_HOUSE_NUMBER && houseNumber <= MAX_HOUSE_NUMBER;
  }

  /**
   * Extrae el número de casa del voucher
   * Estructura: voucher -> records -> house_records -> house.number_house
   *
   * @param voucher - Voucher con relaciones (records)
   * @returns Número de casa válido o null si no está disponible
   */
  private extractHouseNumberFromVoucher(voucher: Voucher): number | null {
    try {
      if (!voucher.records || voucher.records.length === 0) {
        return null;
      }

      for (const record of voucher.records) {
        if (record.houseRecords && record.houseRecords.length > 0) {
          // Retornar el número de casa del primer house_record
          const houseNumber = record.houseRecords[0].house?.number_house;

          if (houseNumber !== undefined && houseNumber !== null) {
            return houseNumber;
          }
        }
      }

      this.logger.debug(
        `Voucher ${voucher.id}: No se encontró casa en los house_records`,
      );
      return null;
    } catch (error) {
      this.logger.warn(
        `Error extrayendo casa del voucher ${voucher.id}: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      return null;
    }
  }

  /**
   * Calcula el score de similitud de un candidato basado en la diferencia de fecha
   * Score = 1.0 - (dateDiff / DATE_TOLERANCE_HOURS)
   * Ejemplo: dateDiff=0 → score=1.0 (perfecto), dateDiff=36h → score=0.0
   *
   * @param dateDiff Diferencia de horas
   * @returns Número entre 0 y 1
   */
  private calculateSimilarityScore(dateDiff: number): number {
    const score = 1.0 - dateDiff / ReconciliationConfig.DATE_TOLERANCE_HOURS;
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Crea un caso que requiere validación manual
   * Se usa cuando hay múltiples vouchers con similaridad muy cercana
   *
   * @param transaction Transacción bancaria
   * @param candidates Array de vouchers candidatos con sus datos
   * @returns ManualValidationCase
   */
  private createManualValidationCase(
    transaction: TransactionBank,
    candidates: Array<{
      voucher: Voucher;
      dateDiff: number;
      similarity: number;
    }>,
  ): ManualValidationCase {
    // Ordenar por similaridad descendente (mejor primero)
    const sorted = [...candidates].sort((a, b) => b.similarity - a.similarity);

    const reason = `${sorted.length} vouchers con monto exacto ($${transaction.amount.toFixed(2)}) y similitud muy cercana. Diferencia máxima entre candidatos: ${(sorted[0].similarity - sorted[sorted.length - 1].similarity).toFixed(2)}.`;

    return ManualValidationCase.create({
      transaction,
      possibleMatches: sorted.map((c) => ({
        voucher: c.voucher,
        dateDifferenceHours: c.dateDiff,
        similarityScore: c.similarity,
      })),
      reason,
    });
  }
}
