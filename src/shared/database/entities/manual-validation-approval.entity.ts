import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { TransactionBank } from './transaction-bank.entity';
import { Voucher } from './voucher.entity';
import { User } from './user.entity';

/**
 * Entidad que registra auditoría de aprobaciones/rechazos en validación manual
 *
 * Propósito: Mantener un historial completo de quién aprobó/rechazó cada caso
 * y qué decisión tomó, para trazabilidad y análisis posterior.
 */
@Entity('manual_validation_approvals')
@Index('idx_manual_validation_approvals_transaction', ['transaction_id'])
@Index('idx_manual_validation_approvals_user', ['approved_by_user_id'])
@Index('idx_manual_validation_approvals_created', ['approved_at'])
export class ManualValidationApproval {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * ID de la transacción bancaria que fue revisada
   */
  @Column({ type: 'bigint', nullable: false })
  transaction_id: number;

  /**
   * ID del voucher elegido (NULL si fue rechazado)
   */
  @Column({ type: 'integer', nullable: true })
  voucher_id: number | null;

  /**
   * ID del usuario que aprobó o rechazó el caso
   */
  @Column({ type: 'varchar', length: 128, nullable: false })
  approved_by_user_id: string;

  /**
   * Notas/comentarios del operador sobre la decisión
   */
  @Column({ type: 'text', nullable: true })
  approval_notes: string;

  /**
   * Razón del rechazo (si aplica)
   */
  @Column({ type: 'text', nullable: true })
  rejection_reason: string;

  /**
   * Timestamp de la aprobación o rechazo
   */
  @CreateDateColumn()
  approved_at: Date;

  // ==================== RELACIONES ====================

  /**
   * Relación con la transacción bancaria
   */
  @ManyToOne(() => TransactionBank, {
    nullable: false,
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'transaction_id' })
  transactionBank: TransactionBank;

  /**
   * Relación con el voucher elegido (nullable si fue rechazado)
   */
  @ManyToOne(() => Voucher, {
    nullable: true,
    onDelete: 'SET NULL',
    eager: true,
  })
  @JoinColumn({ name: 'voucher_id' })
  voucher: Voucher;

  /**
   * Relación con el usuario que aprobó/rechazó
   */
  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
    eager: true,
  })
  @JoinColumn({ name: 'approved_by_user_id' })
  approvedByUser: User;

  // ==================== MÉTODOS ÚTILES ====================

  /**
   * Determina si este registro es una aprobación o un rechazo
   * @returns true si fue aprobado (voucher_id NOT NULL), false si fue rechazado
   */
  isApproved(): boolean {
    return this.voucher_id !== null;
  }

  /**
   * Obtiene un resumen legible del registro
   */
  getSummary(): string {
    const action = this.isApproved()
      ? `Aprobado con Voucher #${this.voucher_id}`
      : 'Rechazado';
    const user = this.approvedByUser?.email || 'Usuario desconocido';
    const date = this.approved_at.toLocaleDateString('es-AR');

    return `${action} por ${user} el ${date}`;
  }
}
