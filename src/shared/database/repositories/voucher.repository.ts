import { Injectable } from '@nestjs/common';
import { Repository, Between } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Voucher } from '../entities/voucher.entity';

export interface CreateVoucherDto {
  date: Date | string;
  authorization_number?: string;
  confirmation_code: string;
  amount: number;
  confirmation_status?: boolean;
  url?: string;
}

export interface UpdateVoucherDto {
  authorization_number?: string;
  confirmation_status?: boolean;
  url?: string;
}

@Injectable()
export class VoucherRepository {
  constructor(
    @InjectRepository(Voucher)
    private voucherRepository: Repository<Voucher>,
  ) {}

  /**
   * Crea un nuevo voucher en la base de datos
   */
  async create(data: CreateVoucherDto): Promise<Voucher> {
    // Convertir string a Date si es necesario
    // Si ya es Date object (con hora incluida), se usa directamente
    let parsedDate: Date;
    if (typeof data.date === 'string') {
      // Si es formato ISO date (YYYY-MM-DD), crear Date a las 00:00 timezone local
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        const [year, month, day] = data.date.split('-').map(Number);
        parsedDate = new Date(year, month - 1, day);
      } else {
        // Otros formatos de string (ISO completo, etc.)
        parsedDate = new Date(data.date);
      }
    } else {
      // Es un Date object - se usa directamente preservando fecha y hora
      parsedDate = data.date;
    }

    const voucherData: Partial<Voucher> = {
      date: parsedDate,
      authorization_number: data.authorization_number || undefined,
      confirmation_code: data.confirmation_code,
      amount: data.amount,
      confirmation_status: data.confirmation_status || false,
      url: data.url || undefined,
    };

    const voucher = this.voucherRepository.create(voucherData);
    return await this.voucherRepository.save(voucher);
  }

  /**
   * Busca un voucher por su ID
   */
  async findById(id: number): Promise<Voucher | null> {
    return this.voucherRepository.findOne({ where: { id } });
  }

  /**
   * Busca un voucher por su ID con información de casa asociada
   */
  async findByIdWithHouse(id: number): Promise<Voucher | null> {
    return this.voucherRepository.findOne({
      where: { id },
      relations: {
        records: {
          houseRecords: {
            house: true,
          },
        },
      },
    });
  }

  /**
   * Busca un voucher por su código de confirmación
   */
  async findByConfirmationCode(
    confirmationCode: string,
  ): Promise<Voucher | null> {
    return this.voucherRepository.findOne({
      where: { confirmation_code: confirmationCode },
    });
  }

  /**
   * Obtiene todos los vouchers
   */
  async findAll(): Promise<Voucher[]> {
    return this.voucherRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene todos los vouchers con información de casa asociada
   * Incluye las relaciones: voucher -> records -> house_records -> house
   */
  async findAllWithHouse(): Promise<Voucher[]> {
    return this.voucherRepository.find({
      relations: {
        records: {
          houseRecords: {
            house: true,
          },
        },
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene vouchers por estado de confirmación
   */
  async findByConfirmationStatus(confirmed: boolean): Promise<Voucher[]> {
    return this.voucherRepository.find({
      where: { confirmation_status: confirmed },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene vouchers por estado de confirmación con información de casa asociada
   */
  async findByConfirmationStatusWithHouse(
    confirmed: boolean,
  ): Promise<Voucher[]> {
    return this.voucherRepository.find({
      where: { confirmation_status: confirmed },
      relations: {
        records: {
          houseRecords: {
            house: true,
          },
        },
      },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene vouchers en un rango de fechas
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Voucher[]> {
    return this.voucherRepository.find({
      where: {
        date: Between(startDate, endDate),
      },
      order: { date: 'DESC' },
    });
  }

  /**
   * Obtiene vouchers en un rango de fechas con información de casa asociada
   */
  async findByDateRangeWithHouse(
    startDate: Date,
    endDate: Date,
  ): Promise<Voucher[]> {
    return this.voucherRepository.find({
      where: {
        date: Between(startDate, endDate),
      },
      relations: {
        records: {
          houseRecords: {
            house: true,
          },
        },
      },
      order: { date: 'DESC' },
    });
  }

  /**
   * Actualiza un voucher por su ID
   */
  async update(id: number, data: UpdateVoucherDto): Promise<Voucher> {
    await this.voucherRepository.update(id, data);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Voucher con ID ${id} no encontrado`);
    }
    return updated;
  }

  /**
   * Elimina un voucher por su ID
   */
  async delete(id: number): Promise<void> {
    await this.voucherRepository.delete(id);
  }

  /**
   * Cuenta vouchers por estado de confirmación
   */
  async countByStatus(): Promise<{
    total: number;
    confirmed: number;
    pending: number;
  }> {
    const total = await this.voucherRepository.count();
    const confirmed = await this.voucherRepository.count({
      where: { confirmation_status: true },
    });
    const pending = total - confirmed;

    return { total, confirmed, pending };
  }

  /**
   * Verifica si un archivo GCS está referenciado en algún voucher
   * Usado por VoucherGarbageCollectorService para detectar archivos huérfanos
   *
   * @param filename Nombre del archivo GCS (ej: p-2024-01-15_14-30-45-uuid.jpg)
   * @returns true si existe voucher con url = filename, false si no
   */
  async isFileReferenced(filename: string): Promise<boolean> {
    const count = await this.voucherRepository.count({
      where: { url: filename },
    });
    return count > 0;
  }
}
