import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionStatus } from './transaction-status.entity';
import { LastTransactionBank } from './last-transaction-bank.entity';
import { ManualValidationApproval } from './manual-validation-approval.entity';

@Entity('transactions_bank')
export class TransactionBank {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'time' })
  time: string;

  @Column({ type: 'varchar', length: 225, nullable: true })
  concept: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({
    type: 'boolean',
    comment: 'Indica si es deposito: true, retiro: false',
  })
  is_deposit: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currency: string;

  @Column({ type: 'text', nullable: true })
  bank_name: string;

  @Column({ type: 'boolean', default: false })
  confirmation_status: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(
    () => TransactionStatus,
    (transactionStatus) => transactionStatus.transactionBank,
  )
  transactionStatuses: TransactionStatus[];

  @OneToMany(
    () => LastTransactionBank,
    (lastTransaction) => lastTransaction.transactionBank,
  )
  lastTransactions: LastTransactionBank[];

  @OneToMany(
    () => ManualValidationApproval,
    (approval) => approval.transactionBank,
  )
  manualValidationApprovals: ManualValidationApproval[];
}
