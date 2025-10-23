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
import { ValidationStatus } from './enums';
import { TransactionBank } from './transaction-bank.entity';
import { Voucher } from './voucher.entity';
import { Record } from './record.entity';

@Entity('transactions_status')
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
  transactions_bank_id: string;

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
