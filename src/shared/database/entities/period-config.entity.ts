import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Configuración de períodos con versionado por fechas
 * Permite cambiar montos default y reglas de pago en diferentes momentos
 */
@Entity('period_config')
export class PeriodConfig {
  @PrimaryGeneratedColumn()
  id: number;

  // Montos default para conceptos
  @Column({ type: 'float', default: 800 })
  default_maintenance_amount: number;

  @Column({ type: 'float', default: 200, nullable: true })
  default_water_amount: number;

  @Column({ type: 'float', default: 1000, nullable: true })
  default_extraordinary_fee_amount: number;

  // Configuración de penalidades
  @Column({ type: 'int', default: 10, comment: 'Día límite de pago del mes' })
  payment_due_day: number;

  @Column({
    type: 'float',
    default: 100,
    comment: 'Monto fijo de penalidad por pago tardío',
  })
  late_payment_penalty_amount: number;

  // Vigencia de esta configuración
  @Column({
    type: 'date',
    comment: 'Fecha desde la cual esta configuración es válida',
  })
  effective_from: Date;

  @Column({
    type: 'date',
    nullable: true,
    comment:
      'Fecha hasta la cual esta configuración es válida (null = indefinido)',
  })
  effective_until: Date;

  @Column({
    type: 'float',
    default: 100,
    comment:
      'Umbral de centavos acumulados para convertir a crédito (default $100)',
  })
  cents_credit_threshold: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
