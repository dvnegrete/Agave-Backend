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
import { ValidationStatus } from './enums';
import { TransactionBank } from './transaction-bank.entity';
import { Voucher } from './voucher.entity';
import { Record } from './record.entity';

@Entity('transactions_status')
@Index('idx_transaction_status_validation_status', ['validation_status'], {
  where: '"validation_status" IN (\'requires-manual\', \'not-found\', \'conflict\')',
})
@Index('idx_transaction_status_created_at', ['created_at'])
export class TransactionStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ValidationStatus,
    default: ValidationStatus.PENDING,
  })
  validation_status: ValidationStatus;

  @Column({ type: 'bigint', nullable: true })
  transactions_bank_id: number;

  @Column({ type: 'int', nullable: true })
  vouchers_id: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'int', nullable: true })
  identified_house_number: number;

  @Column({ type: 'timestamptz', nullable: true })
  processed_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    possibleMatches?: Array<{
      voucherId: number;
      similarity: number;
      dateDifferenceHours: number;
    }>;
    matchCriteria?: string[];
    confidenceLevel?: string;
  };

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(
    () => TransactionBank,
    (transactionBank) => transactionBank.transactionStatuses,
    {
      nullable: true,
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'transactions_bank_id' })
  transactionBank: TransactionBank;

  @ManyToOne(() => Voucher, (voucher) => voucher.transactionStatuses, {
    nullable: true,
    onUpdate: 'SET NULL',
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'vouchers_id' })
  voucher: Voucher;

  @OneToMany(() => Record, (record) => record.transactionStatus)
  records: Record[];
}
