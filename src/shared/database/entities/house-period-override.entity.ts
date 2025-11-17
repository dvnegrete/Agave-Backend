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
import { ConceptType } from './enums';

/**
 * Sobrescritura de montos para casas específicas en períodos específicos
 * Permite manejar convenios de pago, descuentos, o montos personalizados
 */
@Entity('house_period_overrides')
@Index(['house_id', 'period_id', 'concept_type'], { unique: true })
export class HousePeriodOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  house_id: number;

  @Column({ type: 'int' })
  period_id: number;

  @Column({
    type: 'enum',
    enum: ConceptType,
    comment: 'Tipo de concepto que se está sobrescribiendo',
  })
  concept_type: ConceptType;

  @Column({
    type: 'float',
    comment: 'Monto personalizado para esta casa en este período',
  })
  custom_amount: number;

  @Column({
    type: 'text',
    nullable: true,
    comment: 'Razón del ajuste (ej: convenio de pago, descuento, etc.)',
  })
  reason: string;

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
