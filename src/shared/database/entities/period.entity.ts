import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { CtaExtraordinaryFee } from './cta-extraordinary-fee.entity';
import { CtaMaintenance } from './cta-maintenance.entity';
import { CtaPenalties } from './cta-penalties.entity';
import { CtaWater } from './cta-water.entity';
import { PeriodConfig } from './period-config.entity';
import { RecordAllocation } from './record-allocation.entity';
import { HousePeriodOverride } from './house-period-override.entity';

@Entity('periods')
@Index(['year', 'month'], { unique: true })
export class Period {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number;

  @Column({
    type: 'date',
    generatedType: 'STORED',
    asExpression: 'make_date(year, month, 1)',
  })
  start_date: Date;

  @Column({
    type: 'date',
    generatedType: 'STORED',
    asExpression: "(make_date(year, month, 1) + interval '1 month - 1 day')",
  })
  end_date: Date;

  @Column({ type: 'int', nullable: true })
  period_config_id: number;

  @Column({ type: 'boolean', default: false })
  water_active: boolean;

  @Column({ type: 'boolean', default: false })
  extraordinary_fee_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => PeriodConfig, { nullable: true })
  @JoinColumn({ name: 'period_config_id' })
  periodConfig: PeriodConfig;

  @OneToMany(() => CtaExtraordinaryFee, (fee) => fee.period)
  extraordinaryFees: CtaExtraordinaryFee[];

  @OneToMany(() => CtaMaintenance, (maintenance) => maintenance.period)
  maintenances: CtaMaintenance[];

  @OneToMany(() => CtaPenalties, (penalties) => penalties.period)
  penalties: CtaPenalties[];

  @OneToMany(() => CtaWater, (water) => water.period)
  waters: CtaWater[];

  @OneToMany(() => RecordAllocation, (allocation) => allocation.period)
  recordAllocations: RecordAllocation[];

  @OneToMany(() => HousePeriodOverride, (override) => override.period)
  housePeriodOverrides: HousePeriodOverride[];
}
