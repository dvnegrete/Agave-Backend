import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Period } from './period.entity';
import { Record } from './record.entity';

@Entity('cta_extraordinary_fee')
export class CtaExtraordinaryFee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'int' })
  period_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Period, (period) => period.extraordinaryFees, {
    onUpdate: 'CASCADE',
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'period_id' })
  period: Period;

  @OneToMany(() => Record, (record) => record.ctaExtraordinaryFee)
  records: Record[];
}
