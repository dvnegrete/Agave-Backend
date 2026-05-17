import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Express } from 'express';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { RoleGuard } from '@/shared/auth/guards/roles.guard';
import { Roles } from '@/shared/auth/decorators/roles.decorator';
import { CurrentUser } from '@/shared/auth/decorators/current-user.decorator';
import { Role } from '@/shared/database/entities/enums';
import { User } from '@/shared/database/entities/user.entity';
import { ListDocumentsUseCase } from '../application/list-documents.use-case';
import { GetSignedUrlUseCase } from '../application/get-signed-url.use-case';
import { UploadDocumentUseCase } from '../application/upload-document.use-case';
import { DeleteDocumentUseCase } from '../application/delete-document.use-case';
import {
  ListDocumentsQueryDto,
  CondoDocumentTypeDto,
  SignedUrlQueryDto,
  SignedUrlResponseDto,
  UploadDocumentDto,
  UploadDocumentResponseDto,
} from '../dto';
import { DocumentItem } from '../interfaces/document-item.interface';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('condo-documents')
@ApiBearerAuth()
@Controller('condo-documents')
export class CondoDocumentsController {
  private readonly logger = new Logger(CondoDocumentsController.name);

  constructor(
    private readonly listDocumentsUseCase: ListDocumentsUseCase,
    private readonly getSignedUrlUseCase: GetSignedUrlUseCase,
    private readonly uploadDocumentUseCase: UploadDocumentUseCase,
    private readonly deleteDocumentUseCase: DeleteDocumentUseCase,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar documentos del condominio por tipo',
    description:
      'Documentos generales: cualquier usuario autenticado. Minutas: solo admin y owner.',
  })
  @ApiResponse({ status: 200, description: 'Lista de documentos' })
  async listDocuments(
    @Query() query: ListDocumentsQueryDto,
    @CurrentUser() user: User,
  ): Promise<DocumentItem[]> {
    this.assertMinuteAccess(query.type, user);

    this.logger.log(
      `Listando documentos type=${query.type} para usuario ${user.id}`,
    );

    return this.listDocumentsUseCase.execute(query.type);
  }

  @Get('signed-url')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar URL firmada (15 min) para descargar/ver un PDF',
  })
  @ApiResponse({ status: 200, type: SignedUrlResponseDto })
  async getSignedUrl(
    @Query() query: SignedUrlQueryDto,
    @CurrentUser() user: User,
  ): Promise<SignedUrlResponseDto> {
    this.assertMinuteAccess(query.type, user);

    return this.getSignedUrlUseCase.execute(query.name, query.type);
  }

  @Post('upload')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Solo se permiten archivos PDF'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Subir un PDF (solo admin)',
    description:
      'Sube un PDF al bucket de documentos del condominio con metadatos según tipo',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['document', 'minute'] },
        date: {
          type: 'string',
          description: 'Solo para minutas (formato ddmmaaaa)',
        },
        name: {
          type: 'string',
          description: 'Solo para documentos generales (nombre sin extensión)',
        },
      },
      required: ['file', 'type'],
    },
  })
  @ApiResponse({ status: 201, type: UploadDocumentResponseDto })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ): Promise<UploadDocumentResponseDto> {
    return this.uploadDocumentUseCase.execute(
      file,
      dto.type,
      dto.date,
      dto.name,
    );
  }

  @Delete()
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar un documento del bucket (solo admin)',
  })
  @ApiResponse({ status: 200, description: 'Documento eliminado' })
  async deleteDocument(
    @Query('name') name: string,
  ): Promise<{ deleted: true; name: string }> {
    if (!name?.trim()) {
      throw new BadRequestException('El parámetro "name" es requerido');
    }
    this.logger.log(`Eliminando documento: ${name}`);
    return this.deleteDocumentUseCase.execute(name);
  }

  private assertMinuteAccess(type: CondoDocumentTypeDto, user: User): void {
    if (type !== CondoDocumentTypeDto.MINUTE) {
      return;
    }
    if (user.role !== Role.ADMIN && user.role !== Role.OWNER) {
      throw new ForbiddenException(
        'Solo administradores y propietarios pueden acceder a las minutas',
      );
    }
  }
}
