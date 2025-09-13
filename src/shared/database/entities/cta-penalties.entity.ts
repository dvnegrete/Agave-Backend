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

@Entity('cta_penalties')
export class CtaPenalties {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'int', nullable: true })
  period_id: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Period, (period) => period.penalties, { 
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'NO ACTION'
  })
  @JoinColumn({ name: 'period_id' })
  period: Period;

  @OneToMany(() => Record, (record) => record.ctaPenalties)
  records: Record[];
}
