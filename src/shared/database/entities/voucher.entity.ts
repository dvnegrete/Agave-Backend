import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TransactionStatus } from './transaction-status.entity';
import { Record } from './record.entity';
import { ManualValidationApproval } from './manual-validation-approval.entity';

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamptz', nullable: true })
  date: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  authorization_number: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  confirmation_code: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'boolean', default: false })
  confirmation_status: boolean;

  @Column({ type: 'text', nullable: true })
  url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(
    () => TransactionStatus,
    (transactionStatus) => transactionStatus.voucher,
  )
  transactionStatuses: TransactionStatus[];

  @OneToMany(() => Record, (record) => record.voucher)
  records: Record[];

  @OneToMany(() => ManualValidationApproval, (approval) => approval.voucher)
  manualValidationApprovals: ManualValidationApproval[];
}
