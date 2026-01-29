import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { HouseRecord } from './house-record.entity';
import { HouseBalance } from './house-balance.entity';
import { HousePeriodOverride } from './house-period-override.entity';
import { RecordAllocation } from './record-allocation.entity';

@Entity('houses')
export class House {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unique: true })
  number_house: number;

  @Column({ type: 'varchar', length: 128 })
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.houses, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => HouseRecord, (houseRecord) => houseRecord.house)
  houseRecords: HouseRecord[];

  @OneToOne(() => HouseBalance, (balance) => balance.house, {
    nullable: true,
  })
  houseBalance: HouseBalance;

  @OneToMany(
    () => HousePeriodOverride,
    (override) => override.house,
  )
  housePeriodOverrides: HousePeriodOverride[];

  @OneToMany(
    () => RecordAllocation,
    (allocation) => allocation.house,
  )
  recordAllocations: RecordAllocation[];
}
