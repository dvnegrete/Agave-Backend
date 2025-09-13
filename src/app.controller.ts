import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('db')
  async getDatabaseReady(): Promise<{ message: string }> {
    try {
      // Consulta trivial para verificar la conexión
      await this.dataSource.query('SELECT 1');
      return { message: 'base de datos preparada' };
    } catch {
      throw new ServiceUnavailableException(
        'no hay conexión a la base de datos',
      );
    }
  }
}
