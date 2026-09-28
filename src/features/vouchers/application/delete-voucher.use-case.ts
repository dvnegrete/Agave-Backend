import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { GcsCleanupService } from '@/shared/libs/google-cloud';

export interface DeleteVoucherOutput {
  deleted: true;
  id: number;
}

/**
 * Use Case: Eliminar un voucher no conciliado
 *
 * - Solo permite eliminar vouchers con confirmation_status=false
 * - Las referencias en transactions_status, records y
 *   manual_validation_approvals quedan en NULL (FK ON DELETE SET NULL)
 * - Elimina el archivo del comprobante en GCS (no bloqueante)
 */
@Injectable()
export class DeleteVoucherUseCase {
  private readonly logger = new Logger(DeleteVoucherUseCase.name);

  constructor(
    private readonly voucherRepository: VoucherRepository,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  async execute(id: number): Promise<DeleteVoucherOutput> {
    const voucher = await this.voucherRepository.findById(id);

    if (!voucher) {
      throw new NotFoundException(`Voucher no encontrado: ${id}`);
    }

    if (voucher.confirmation_status === true) {
      throw new BadRequestException(
        `No se puede eliminar el voucher ${id} porque ya fue conciliado`,
      );
    }

    await this.voucherRepository.delete(id);
    this.logger.log(`Voucher ${id} eliminado`);

    if (voucher.url) {
      await this.gcsCleanupService.deleteFile(voucher.url, {
        reason: 'voucher-eliminado',
        fileType: 'permanente',
        blocking: false,
      });
    }

    return { deleted: true, id };
  }
}
