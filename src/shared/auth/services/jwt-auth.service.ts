import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { House } from '../../database/entities/house.entity';

export interface JwtAccessPayload {
  sub: string; // userId (UUID)
  email: string;
  role: string; // Role enum as string
  houseIds: number[]; // array of number_house
  firstName?: string;
  lastName?: string;
  avatar?: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string; // userId (UUID)
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  houseIds?: number[]; // array of number_house
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtAuthService {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(House)
    private houseRepository: Repository<House>,
  ) {}

  async generateAccessToken(user: User): Promise<string> {
    const houseIds = await this.getUserHouseIds(user.id);

    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      houseIds,
      firstName: user.name?.split(' ')[0],
      lastName: user.name?.split(' ')[1],
      avatar: user.avatar,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '15m',
    });
  }

  async generateRefreshToken(user: User | string): Promise<string> {
    // Support both User object and userId string for backwards compatibility
    if (typeof user === 'string') {
      // Legacy mode: only userId provided
      const payload: JwtRefreshPayload = {
        sub: user,
        email: '',
      };
      return this.jwtService.sign(payload, {
        expiresIn: '7d',
      });
    }

    // New mode: full User object provided
    const houseIds = user.houses?.map((house) => house.number_house) || [];
    const payload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
      firstName: user.name?.split(' ')[0],
      lastName: user.name?.split(' ').slice(1).join(' '),
      role: user.role,
      houseIds,
    };

    return this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
  }

  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    return this.jwtService.verify(token) as JwtAccessPayload;
  }

  async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    return this.jwtService.verify(token) as JwtRefreshPayload;
  }

  private async getUserHouseIds(userId: string): Promise<number[]> {
    const houses = await this.houseRepository.find({
      where: { user_id: userId },
      select: ['number_house'],
    });

    return houses.map((house) => house.number_house);
  }
}
