import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { House } from './house.entity';

/**
 * Balance y saldos acumulados por casa
 * Gestiona centavos acumulados, saldos a favor y deudas
 */
@Entity('house_balances')
export class HouseBalance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  house_id: number;

  @Column({
    type: 'float',
    default: 0,
    comment:
      'Centavos acumulados de pagos. Se convierten a crédito al alcanzar cents_credit_threshold de PeriodConfig.',
  })
  accumulated_cents: number;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Saldo a favor por pagos adelantados o pagos mayores',
  })
  credit_balance: number;

  @Column({
    type: 'float',
    default: 0,
    comment: 'Deuda acumulada por pagos incompletos o faltantes',
  })
  debit_balance: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToOne(() => House, (house) => house.houseBalance, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'house_id' })
  house: House;
}
