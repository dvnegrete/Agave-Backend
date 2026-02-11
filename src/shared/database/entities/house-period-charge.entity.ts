import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { House } from './house.entity';
import { Period } from './period.entity';
import { AllocationConceptType } from './enums';

/**
 * Snapshot inmutable de cargos esperados por casa y período
 * Persiste los montos esperados al crear el período, evitando recálculos dinámicos
 */
@Entity('house_period_charges')
@Index(['house_id', 'period_id', 'concept_type'], { unique: true })
export class HousePeriodCharge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  house_id: number;

  @Column({ type: 'int' })
  period_id: number;

  @Column({
    type: 'enum',
    enum: AllocationConceptType,
    comment: 'Tipo de concepto del cargo',
  })
  concept_type: AllocationConceptType;

  @Column({
    type: 'float',
    comment: 'Monto esperado para esta casa en este período',
  })
  expected_amount: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'period_config',
    comment:
      'Origen del monto: period_config, override, auto_penalty, manual',
  })
  source: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => House, { onUpdate: 'CASCADE', onDelete: 'CASCADE' })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @ManyToOne(() => Period, { onUpdate: 'CASCADE', onDelete: 'CASCADE' })
  @JoinColumn({ name: 'period_id' })
  period: Period;
}
