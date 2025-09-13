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

@Entity('vouchers')
export class Voucher {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'timestamp' })
  date: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  authorization_number: string;

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
}
