import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { House } from '../entities/house.entity';
import { Retry } from '../../decorators/retry.decorator';

export interface CreateHouseDto {
  number_house: number;
  user_id: string;
}

export interface UpdateHouseDto {
  user_id?: string;
}

@Injectable()
export class HouseRepository {
  constructor(
    @InjectRepository(House)
    private houseRepository: Repository<House>,
  ) {}

  /**
   * Crea una nueva casa en la base de datos
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  })
  async create(
    data: CreateHouseDto,
    queryRunner?: QueryRunner,
  ): Promise<House> {
    const houseData: Partial<House> = {
      number_house: data.number_house,
      user_id: data.user_id,
    };

    if (queryRunner) {
      const house = queryRunner.manager.create(House, houseData);
      return await queryRunner.manager.save(house);
    }

    const house = this.houseRepository.create(houseData);
    return await this.houseRepository.save(house);
  }

  /**
   * Busca una casa por su ID
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findById(id: number): Promise<House | null> {
    return this.houseRepository.findOne({ where: { id } });
  }

  /**
   * Busca una casa por su número de casa
   * @param numberHouse Número de la casa a buscar
   * @param queryRunner QueryRunner para buscar dentro de una transacción (opcional)
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findByNumberHouse(
    numberHouse: number,
    queryRunner?: QueryRunner,
  ): Promise<House | null> {
    if (queryRunner) {
      return queryRunner.manager.findOne(House, {
        where: { number_house: numberHouse },
        relations: ['user', 'houseRecords'],
      });
    }

    return this.houseRepository.findOne({
      where: { number_house: numberHouse },
      relations: ['user', 'houseRecords'],
    });
  }

  /**
   * Busca todas las casas de un usuario
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findByUserId(userId: string): Promise<House[]> {
    return this.houseRepository.find({
      where: { user_id: userId },
      relations: ['houseRecords'],
      order: { number_house: 'ASC' },
    });
  }

  /**
   * Obtiene todas las casas
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findAll(): Promise<House[]> {
    return this.houseRepository.find({
      relations: ['user', 'houseRecords'],
      order: { number_house: 'ASC' },
    });
  }

  /**
   * Actualiza una casa por su ID (ej: cambiar de propietario)
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  })
  async update(id: number, data: UpdateHouseDto): Promise<House> {
    await this.houseRepository.update(id, data);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Casa con ID ${id} no encontrada`);
    }
    return updated;
  }

  /**
   * Actualiza el propietario de una casa por número de casa
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  })
  async updateOwner(numberHouse: number, userId: string): Promise<House> {
    const house = await this.findByNumberHouse(numberHouse);
    if (!house) {
      throw new Error(`Casa ${numberHouse} no encontrada`);
    }
    return this.update(house.id, { user_id: userId });
  }

  /**
   * Elimina una casa por su ID
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async delete(id: number): Promise<void> {
    await this.houseRepository.delete(id);
  }

  /**
   * Verifica si una casa existe
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async exists(numberHouse: number): Promise<boolean> {
    const count = await this.houseRepository.count({
      where: { number_house: numberHouse },
    });
    return count > 0;
  }
}
