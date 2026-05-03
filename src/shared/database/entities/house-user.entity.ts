import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { House } from './house.entity';
import { User } from './user.entity';

@Entity('house_users')
@Index('idx_house_users_house_id', ['house_id'])
@Index('idx_house_users_user_id', ['user_id'])
export class HouseUser {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  house_id: number;

  @Column({ type: 'varchar', length: 128 })
  user_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => House, (house) => house.houseUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'house_id' })
  house: House;

  @ManyToOne(() => User, (user) => user.houseUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
