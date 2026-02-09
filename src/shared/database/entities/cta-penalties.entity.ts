import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Period } from './period.entity';
import { Record } from './record.entity';
import { House } from './house.entity';

@Entity('cta_penalties')
export class CtaPenalties {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'int', nullable: true })
  period_id: number;

  @Column({ type: 'int', nullable: true })
  house_id: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Period, (period) => period.penalties, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'period_id' })
  period: Period;

  @ManyToOne(() => House, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @OneToMany(() => Record, (record) => record.ctaPenalties)
  records: Record[];
}
