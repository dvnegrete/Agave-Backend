import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { House } from './house.entity';

/**
 * Snapshot denormalizado del estado calculado de una casa
 * Materializa el resultado de CalculateHouseBalanceStatusUseCase para evitar recálculos repetidos
 * TTL: 24 horas para capturar cambios basados en tiempo (overdue, penalties generadas)
 */
@Entity('house_status_snapshots')
@Index('idx_house_status_snapshots_is_stale', ['is_stale'])
export class HouseStatusSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  house_id: number;

  @Column({
    type: 'varchar',
    length: 20,
    comment: "Estado de la casa: 'morosa' / 'al_dia' / 'saldo_a_favor'",
  })
  status: string;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Deuda total denormalizada para queries',
  })
  total_debt: number;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Saldo a favor denormalizado para queries',
  })
  credit_balance: number;

  @Column({
    type: 'int',
    default: 0,
    comment: 'Conteo de períodos impagos denormalizado',
  })
  total_unpaid_periods: number;

  @Column({
    type: 'jsonb',
    comment:
      'Resultado completo de EnrichedHouseBalance (periods, concepts, summary)',
  })
  enriched_data: Record<string, any>;

  @Column({
    type: 'boolean',
    default: true,
    comment: 'Flag de invalidación: true = necesita recalcular, false = fresco',
  })
  is_stale: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Cuándo se calculó el snapshot',
  })
  calculated_at: Date | null;

  @Column({
    type: 'timestamp',
    nullable: true,
    comment: 'Cuándo se marcó como stale por último',
  })
  invalidated_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => House, (house) => house.statusSnapshot, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'house_id' })
  house: House;
}
