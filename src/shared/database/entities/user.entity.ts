import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role, Status } from './enums';
import { House } from './house.entity';
import { ManualValidationApproval } from './manual-validation-approval.entity';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.TENANT,
  })
  role: Role;

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.ACTIVE,
  })
  status: Status;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  //TODO: review database with name "mail" vs "email"
  @Column({ type: 'varchar', length: 255, nullable: true })
  mail: string;

  @Column({ type: 'numeric', nullable: true })
  cel_phone: number;

  @Column({ type: 'text', nullable: true })
  avatar: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_login: Date;

  @Column({ type: 'text', nullable: true })
  observations: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => House, (house) => house.user)
  houses: House[];

  @OneToMany(
    () => ManualValidationApproval,
    (approval) => approval.approvedByUser,
  )
  manualValidationApprovals: ManualValidationApproval[];
}
