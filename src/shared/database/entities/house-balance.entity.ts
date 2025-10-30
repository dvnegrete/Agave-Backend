import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
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

  // TODO: Implementar lógica de cuando y cómo aplicar centavos acumulados
  // Actualmente se acumulan pero falta definir:
  // - ¿Se aplican automáticamente al final del año?
  // - ¿Se aplican solo a mantenimiento o a todos los conceptos?
  // - ¿Requiere aprobación manual?
  @Column({
    type: 'float',
    default: 0,
    comment:
      'Centavos acumulados de pagos (solo decimales, 0.00 - 0.99). Pendiente definir aplicación automática.',
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

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => House, { onUpdate: 'CASCADE', onDelete: 'CASCADE' })
  @JoinColumn({ name: 'house_id' })
  house: House;
}
