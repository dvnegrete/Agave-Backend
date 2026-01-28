import { Injectable, Logger } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Role, Status } from '../entities/enums';
import { Retry } from '../../decorators/retry.decorator';

export interface CreateUserDto {
  id: string; // UUID generado manualmente
  cel_phone?: number;
  role?: Role;
  status?: Status;
  name?: string;
  email?: string;
  avatar?: string;
  observations?: string;
  email_verified?: boolean;
  email_verified_at?: Date;
}

export interface UpdateUserDto {
  role?: Role;
  status?: Status;
  name?: string;
  email?: string;
  cel_phone?: number;
  avatar?: string;
  last_login?: Date;
  observations?: string;
  email_verified?: boolean;
  email_verified_at?: Date;
}

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Crea un nuevo usuario en la base de datos
   * Con reintentos automáticos en caso de conexión a BD
   */
  @Retry({ maxAttempts: 3, delayMs: 1000 })
  async create(data: CreateUserDto, queryRunner?: QueryRunner): Promise<User> {
    const userData: Partial<User> = {
      id: data.id,
      cel_phone: data.cel_phone,
      role: data.role ?? Role.TENANT,
      status: data.status ?? Status.ACTIVE,
      name: data.name,
      email: data.email,
      avatar: data.avatar,
      observations: data.observations,
      email_verified: data.email_verified ?? false,
      email_verified_at: data.email_verified_at,
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
   * Con reintentos automáticos en caso de conexión a BD
   */
  @Retry({ maxAttempts: 3, delayMs: 1000 })
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
   * Con reintentos automáticos en caso de conexión a BD
   */
  @Retry({ maxAttempts: 3, delayMs: 1000 })
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
    });
  }

  /**
   * Busca un usuario por su email con sus casas
   * Con reintentos automáticos en caso de conexión a BD
   */
  @Retry({ maxAttempts: 3, delayMs: 1000 })
  async findByEmailWithHouses(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email },
      relations: { houses: true },
    });
  }

  /**
   * Busca un usuario por su ID con sus casas
   * Con reintentos automáticos en caso de conexión a BD
   */
  @Retry({ maxAttempts: 3, delayMs: 1000 })
  async findByIdWithHouses(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      relations: { houses: true },
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
   * Con reintentos automáticos en caso de conexión a BD
   */
  @Retry({ maxAttempts: 3, delayMs: 1000 })
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
