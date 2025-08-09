import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './database/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('db')
  async getDatabaseReady(): Promise<{ message: string }> {
    try {
      // Consulta trivial para verificar la conexión
      await this.prismaService.$queryRaw`SELECT 1`;
      return { message: 'base de datos preparada' };
    } catch (error) {
      throw new ServiceUnavailableException('no hay conexión a la base de datos');
    }
  }
}
