import { Module } from '@nestjs/common';
import { AuthModule } from '@/shared/auth/auth.module';
import { CondoDocumentsController } from './controllers/condo-documents.controller';
import { ListDocumentsUseCase } from './application/list-documents.use-case';
import { GetSignedUrlUseCase } from './application/get-signed-url.use-case';
import { UploadDocumentUseCase } from './application/upload-document.use-case';

@Module({
  imports: [AuthModule],
  controllers: [CondoDocumentsController],
  providers: [
    ListDocumentsUseCase,
    GetSignedUrlUseCase,
    UploadDocumentUseCase,
  ],
})
export class CondoDocumentsModule {}
