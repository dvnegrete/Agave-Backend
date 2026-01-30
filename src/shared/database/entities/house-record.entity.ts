import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { House } from './house.entity';
import { Record } from './record.entity';

@Entity('house_records')
@Index(['house_id', 'record_id'], { unique: true })
export class HouseRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  house_id: number;

  @Column({ type: 'int' })
  record_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => House, (house) => house.houseRecords, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @ManyToOne(() => Record, (record) => record.houseRecords, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'record_id' })
  record: Record;
}
