import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Role, Status } from '../entities/enums';

export interface CreateUserDto {
  id: string; // UUID generado manualmente
  cel_phone: number;
  role?: Role;
  status?: Status;
  name?: string;
  mail?: string;
  avatar?: string;
  observations?: string;
}

export interface UpdateUserDto {
  role?: Role;
  status?: Status;
  name?: string;
  mail?: string;
  cel_phone?: number;
  avatar?: string;
  last_login?: Date;
  observations?: string;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Crea un nuevo usuario en la base de datos
   */
  async create(data: CreateUserDto, queryRunner?: QueryRunner): Promise<User> {
    const userData: Partial<User> = {
      id: data.id,
      cel_phone: data.cel_phone,
      role: data.role ?? Role.TENANT,
      status: data.status ?? Status.ACTIVE,
      name: data.name,
      mail: data.mail,
      avatar: data.avatar,
      observations: data.observations,
    };

    if (queryRunner) {
      const user = queryRunner.manager.create(User, userData);
      return await queryRunner.manager.save(user);
    }

    const user = this.userRepository.create(userData);
    return await this.userRepository.save(user);
  }

  /**
   * Busca un usuario por su ID (UUID)
   */
  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  /**
   * Busca un usuario por su número de teléfono
   */
  async findByCelPhone(celPhone: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { cel_phone: celPhone },
      relations: ['houses'],
    });
  }

  /**
   * Busca un usuario por su email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { mail: email },
    });
  }

  /**
   * Obtiene todos los usuarios
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      relations: ['houses'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene usuarios por rol
   */
  async findByRole(role: Role): Promise<User[]> {
    return this.userRepository.find({
      where: { role },
      order: { name: 'ASC' },
    });
  }

  /**
   * Obtiene usuarios por estado
   */
  async findByStatus(status: Status): Promise<User[]> {
    return this.userRepository.find({
      where: { status },
      order: { name: 'ASC' },
    });
  }

  /**
   * Actualiza un usuario por su ID
   */
  async update(id: string, data: UpdateUserDto): Promise<User> {
    await this.userRepository.update(id, data);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Usuario con ID ${id} no encontrado`);
    }
    return updated;
  }

  /**
   * Actualiza el último login del usuario
   */
  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { last_login: new Date() });
  }

  /**
   * Elimina un usuario por su ID
   */
  async delete(id: string): Promise<void> {
    await this.userRepository.delete(id);
  }

  /**
   * Verifica si un usuario existe por su número de teléfono
   */
  async existsByCelPhone(celPhone: number): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { cel_phone: celPhone },
    });
    return count > 0;
  }

  /**
   * Cuenta usuarios por estado
   */
  async countByStatus(): Promise<{
    total: number;
    active: number;
    inactive: number;
    suspended: number;
  }> {
    const total = await this.userRepository.count();
    const active = await this.userRepository.count({
      where: { status: Status.ACTIVE },
    });
    const inactive = await this.userRepository.count({
      where: { status: Status.INACTIVE },
    });
    const suspended = await this.userRepository.count({
      where: { status: Status.SUSPEND },
    });

    return { total, active, inactive, suspended };
  }
}
