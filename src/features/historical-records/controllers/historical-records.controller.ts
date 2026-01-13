import {
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  Body,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { RoleGuard } from '@/shared/auth/guards/roles.guard';
import { Roles } from '@/shared/auth/decorators/roles.decorator';
import { Role } from '@/shared/database/entities/enums';
import { UploadHistoricalRecordsUseCase } from '../application/upload-historical-records.use-case';
import { UploadHistoricalFileDto, HistoricalRecordResponseDto } from '../dto';
import { HistoricalFileValidator } from '../validators/historical-file.validator';

/**
 * Controller for historical records management
 * Handles file uploads and processing of historical accounting records
 *
 * Requires admin role for all endpoints
 */
@ApiTags('historical-records')
@Controller('historical-records')
export class HistoricalRecordsController {
  private readonly logger = new Logger(HistoricalRecordsController.name);

  constructor(
    private readonly uploadHistoricalRecordsUseCase: UploadHistoricalRecordsUseCase,
  ) {}

  /**
   * Upload and process a historical records Excel file
   * Parses XLSX file, validates rows, and creates historical records in the database
   *
   * Expected Excel columns:
   * - FECHA: Date of the record
   * - HORA: Time of the record
   * - CONCEPTO: Description/concept of the record
   * - DEPOSITO: Total deposit amount
   * - Casa: House number (0 = unidentified, uses deposit cents to identify)
   * - Cuota Extra: Amount for extraordinary fee
   * - Mantto: Amount for maintenance
   * - Penalizacion: Amount for penalties
   * - Agua: Amount for water
   *
   * Business rules:
   * - floor(DEPOSITO) must equal sum of (Cuota Extra + Mantto + Penalizacion + Agua)
   * - If Casa = 0, house number is extracted from deposit cents (e.g., $1542.42 → House 42)
   * - Each row is processed in its own transaction (atomic)
   */
  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Cargar archivo Excel con registros históricos contables',
    description:
      'Procesa un archivo Excel con registros históricos y crea records en el sistema. ' +
      'Archivo debe ser .xlsx con columnas: FECHA, HORA, CONCEPTO, DEPOSITO, Casa, Cuota Extra, Mantto, Penalizacion, Agua.',
  })
  @ApiQuery({
    name: 'bankName',
    required: true,
    description: 'Nombre del banco origen de los registros históricos',
    example: 'BBVA',
    type: String,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Archivo Excel a procesar y parámetros opcionales',
    type: 'multipart/form-data',
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Archivo Excel (.xlsx) con registros históricos',
        },
        description: {
          type: 'string',
          description: 'Descripción opcional del archivo para referencia',
          example: 'Registros históricos 2020-2023',
        },
        validateOnly: {
          type: 'boolean',
          description:
            'Si es true, solo valida los datos sin insertar en la base de datos (modo seco)',
          default: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Procesamiento completado exitosamente',
    type: HistoricalRecordResponseDto,
    schema: {
      example: {
        total_rows: 100,
        successful: 95,
        failed: 5,
        success_rate: 95.0,
        errors: [
          {
            row_number: 15,
            error_type: 'validation',
            message: 'Amount mismatch - floor(1542.42) != 1500',
          },
          {
            row_number: 23,
            error_type: 'database',
            message: 'Casa 99 no existe en el sistema',
            details: {
              concepto: 'Pago mensual',
              deposito: 1500.99,
              casa: 0,
            },
          },
        ],
        created_record_ids: [1, 2, 3, 4, 5],
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Error de validación del archivo o procesamiento',
    schema: {
      example: {
        statusCode: 400,
        message: 'Error al procesar el archivo de registros históricos',
        error: 'Bad Request',
      },
    },
  })
  async uploadHistoricalFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 10 * 1024 * 1024, // 10MB
            message: 'El archivo no debe superar 10MB',
          }),
          new HistoricalFileValidator(),
        ],
        fileIsRequired: true,
        exceptionFactory: (error) => {
          return new BadRequestException(error);
        },
      }),
    )
    file: Express.Multer.File,
    @Query('bankName') bankName: string,
    @Body() uploadDto: UploadHistoricalFileDto,
  ): Promise<HistoricalRecordResponseDto> {
    try {
      if (!bankName || bankName.trim().length === 0) {
        throw new BadRequestException('bankName query parameter is required');
      }

      this.logger.log(
        `Processing historical records file: ${file.originalname} (${file.size} bytes) from bank: ${bankName}`,
      );

      const validateOnly = uploadDto.validateOnly || false;
      const result = await this.uploadHistoricalRecordsUseCase.execute(
        file.buffer,
        validateOnly,
        bankName,
      );

      this.logger.log(
        `File processing completed: ${result.successfulRows}/${result.totalRows} successful`,
      );

      return result.toResponseDto();
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : 'Error al procesar el archivo de registros históricos';

      this.logger.error(`File processing failed: ${errorMsg}`);

      throw new BadRequestException(errorMsg);
    }
  }
}
