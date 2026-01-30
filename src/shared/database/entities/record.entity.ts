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
import { TransactionStatus } from './transaction-status.entity';
import { Voucher } from './voucher.entity';
import { CtaExtraordinaryFee } from './cta-extraordinary-fee.entity';
import { CtaMaintenance } from './cta-maintenance.entity';
import { CtaPenalties } from './cta-penalties.entity';
import { CtaWater } from './cta-water.entity';
import { CtaOtherPayments } from './cta-other-payments.entity';
import { HouseRecord } from './house-record.entity';
import { RecordAllocation } from './record-allocation.entity';

@Entity('records')
export class Record {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  transaction_status_id: number;

  @Column({ type: 'int', nullable: true })
  vouchers_id: number;

  @Column({ type: 'int', nullable: true })
  cta_extraordinary_fee_id: number;

  @Column({ type: 'int', nullable: true })
  cta_maintenance_id: number;

  @Column({ type: 'int', nullable: true })
  cta_penalties_id: number;

  @Column({ type: 'int', nullable: true })
  cta_water_id: number;

  @Column({ type: 'int', nullable: true })
  cta_other_payments_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(
    () => TransactionStatus,
    (transactionStatus) => transactionStatus.records,
    {
      nullable: true,
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'transaction_status_id' })
  transactionStatus: TransactionStatus;

  @ManyToOne(() => Voucher, (voucher) => voucher.records, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'vouchers_id' })
  voucher: Voucher;

  @ManyToOne(() => CtaExtraordinaryFee, (fee) => fee.records, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cta_extraordinary_fee_id' })
  ctaExtraordinaryFee: CtaExtraordinaryFee;

  @ManyToOne(() => CtaMaintenance, (maintenance) => maintenance.records, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cta_maintenance_id' })
  ctaMaintenance: CtaMaintenance;

  @ManyToOne(() => CtaPenalties, (penalties) => penalties.records, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cta_penalties_id' })
  ctaPenalties: CtaPenalties;

  @ManyToOne(() => CtaWater, (water) => water.records, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cta_water_id' })
  ctaWater: CtaWater;

  @ManyToOne(() => CtaOtherPayments, (otherPayments) => otherPayments.records, {
    nullable: true,
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cta_other_payments_id' })
  ctaOtherPayments: CtaOtherPayments;

  @OneToMany(() => HouseRecord, (houseRecord) => houseRecord.record)
  houseRecords: HouseRecord[];

  @OneToMany(() => RecordAllocation, (allocation) => allocation.record)
  allocations: RecordAllocation[];
}
