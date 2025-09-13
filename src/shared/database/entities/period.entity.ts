import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CtaExtraordinaryFee } from './cta-extraordinary-fee.entity';
import { CtaMaintenance } from './cta-maintenance.entity';
import { CtaPenalties } from './cta-penalties.entity';
import { CtaWater } from './cta-water.entity';

@Entity('periods')
export class Period {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  year: number;

  @Column({ type: 'int', unique: true })
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

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CtaExtraordinaryFee, (fee) => fee.period)
  extraordinaryFees: CtaExtraordinaryFee[];

  @OneToMany(() => CtaMaintenance, (maintenance) => maintenance.period)
  maintenances: CtaMaintenance[];

  @OneToMany(() => CtaPenalties, (penalties) => penalties.period)
  penalties: CtaPenalties[];

  @OneToMany(() => CtaWater, (water) => water.period)
  waters: CtaWater[];
}
