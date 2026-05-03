import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HouseUser } from '../entities/house-user.entity';

@Injectable()
export class HouseUserRepository {
  constructor(
    @InjectRepository(HouseUser)
    private houseUserRepository: Repository<HouseUser>,
  ) {}

  /**
   * Obtiene todos los usuarios asignados a una casa.
   * @param loadUser Si true, carga la relación user (para consultar el rol)
   */
  async findByHouseId(houseId: number, loadUser = false): Promise<HouseUser[]> {
    return this.houseUserRepository.find({
      where: { house_id: houseId },
      relations: loadUser ? ['user'] : [],
    });
  }

  /**
   * Obtiene todas las casas asignadas a un usuario (con datos de la casa).
   */
  async findByUserId(userId: string): Promise<HouseUser[]> {
    return this.houseUserRepository.find({
      where: { user_id: userId },
      relations: ['house'],
    });
  }

  /**
   * Verifica si un usuario ya está asignado a una casa.
   */
  async isUserInHouse(houseId: number, userId: string): Promise<boolean> {
    const count = await this.houseUserRepository.count({
      where: { house_id: houseId, user_id: userId },
    });
    return count > 0;
  }

  /**
   * Agrega un usuario a una casa.
   */
  async addUserToHouse(houseId: number, userId: string): Promise<HouseUser> {
    const entity = this.houseUserRepository.create({
      house_id: houseId,
      user_id: userId,
    });
    return this.houseUserRepository.save(entity);
  }

  /**
   * Remueve un usuario de una casa.
   */
  async removeUserFromHouse(houseId: number, userId: string): Promise<void> {
    await this.houseUserRepository.delete({ house_id: houseId, user_id: userId });
  }
}
