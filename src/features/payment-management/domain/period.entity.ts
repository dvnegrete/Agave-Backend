/**
 * Entidad de dominio para Período
 * Representa un período de facturación (generalmente mensual)
 */

export class PeriodDomain {
  constructor(
    public readonly id: number,
    public readonly year: number,
    public readonly month: number,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly periodConfigId?: number,
  ) {}

  static create(params: {
    id: number;
    year: number;
    month: number;
    startDate: Date;
    endDate: Date;
    periodConfigId?: number;
  }): PeriodDomain {
    return new PeriodDomain(
      params.id,
      params.year,
      params.month,
      params.startDate,
      params.endDate,
      params.periodConfigId,
    );
  }

  /**
   * Verifica si el período corresponde a una fecha específica
   */
  containsDate(date: Date): boolean {
    return date >= this.startDate && date <= this.endDate;
  }

  /**
   * Obtiene un identificador legible del período
   */
  getDisplayName(): string {
    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    return `${monthNames[this.month - 1]} ${this.year}`;
  }

  /**
   * Verifica si el período es del año actual
   */
  isCurrentYear(): boolean {
    return this.year === new Date().getFullYear();
  }
}
