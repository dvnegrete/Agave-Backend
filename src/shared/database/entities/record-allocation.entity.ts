import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Record } from './record.entity';
import { Period } from './period.entity';
import { House } from './house.entity';
import { AllocationConceptType, PaymentStatus } from './enums';

/**
 * Distribución detallada de pagos a conceptos y períodos
 * Permite rastrear cómo se aplican los pagos y detectar pagos incompletos
 */
@Entity('record_allocations')
export class RecordAllocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  record_id: number;

  @Column({ type: 'int' })
  house_id: number;

  @Column({ type: 'int' })
  period_id: number;

  @Column({
    type: 'enum',
    enum: AllocationConceptType,
    comment: 'Tipo de concepto al que se aplica el pago',
  })
  concept_type: AllocationConceptType;

  @Column({
    type: 'int',
    comment:
      'ID del concepto específico (cta_maintenance_id, cta_water_id, etc.)',
  })
  concept_id: number;

  @Column({
    type: 'float',
    comment: 'Monto aplicado de este pago a este concepto',
  })
  allocated_amount: number;

  @Column({
    type: 'float',
    comment: 'Monto esperado del concepto (sin centavos, siempre entero)',
  })
  expected_amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    comment: 'Estado del pago: completo, parcial o sobrepagado',
  })
  payment_status: PaymentStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Record, (record) => record.allocations, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'record_id' })
  record: Record;

  @ManyToOne(() => Period, {
    onUpdate: 'CASCADE',
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'period_id' })
  period: Period;

  @ManyToOne(() => House, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'house_id' })
  house: House;
}
