# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start server with debugging enabled
- `npm run start:prod` - Start production server
- `npm run build` - Build the application

### Code Quality
- `npm run lint` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:e2e` - Run end-to-end tests

### Database Operations
- `npm run db:init` - Initialize database (runs scripts/init-db.sh)
- `npm run db:generate` - Generate Prisma client
- `npm run db:deploy` - Deploy migrations to production
- `npm run db:dev` - Run migrations in development
- `npm run db:push` - Push schema changes to database

## Project Architecture

This is a NestJS backend application with a clean architecture pattern organized into features and shared modules.

### Core Structure
```
src/
├── features/                    # Business logic modules
│   ├── transactions-bank/       # Bank transaction processing
│   └── vouchers/               # Voucher processing with OCR
├── shared/                     # Shared utilities and services
│   ├── auth/                   # Authentication guards, decorators, DTOs
│   ├── common/                 # Constants, utilities
│   ├── config/                 # Configuration service
│   ├── database/               # Database module and repositories
│   └── libs/                   # External service integrations
│       ├── google-cloud/       # GCP services (Vision, Speech, etc.)
│       ├── openai/            # OpenAI integration
│       └── vertex-ai/         # Google Vertex AI integration
```

### Key Features
- **Transactions Bank Module**: Processes bank statement files (XLSX, CSV, JSON, TXT) with extensible bank-specific models using Strategy pattern (e.g., `SantanderXlsx`)
- **Vouchers Module**: OCR processing for receipt/voucher images using Google Cloud Vision API
- **Authentication**: Supabase-based auth with JWT guards and decorators
- **AI Integration**: Multiple AI providers (OpenAI, Google Vertex AI, Gemini) for document processing

### Database
- **ORM**: Prisma with PostgreSQL
- **Schema**: Located in `prisma/schema.prisma`
- **Main Models**: Users, Houses, TransactionsBank, Vouchers, TransactionsStatus
- **Multi-tenant**: Houses-Users relationship for property management system

### External Services
- **Supabase**: Authentication and user management
- **Google Cloud Platform**: Vision API (OCR), Speech, Translation, Text-to-Speech
- **OpenAI**: Document analysis and processing
- **Vertex AI**: Google's AI platform integration

### Testing Strategy
- **Unit Tests**: Each service and controller has corresponding `.spec.ts` files
- **E2E Tests**: Located in `test/` directory with Jest configuration
- **Test Database**: Uses separate environment for testing

### Configuration
- **Environment**: Uses `.env` file (see `env.example` for template)
- **TypeScript**: Configured with path aliases (`@/*` maps to `src/*`)
- **ESLint**: TypeScript ESLint with Prettier integration
- **File Validation**: Uses class-validator and class-transformer for DTOs

### Development Notes
- **File Processing**: Supports multiple formats with multer integration
- **Error Handling**: Global validation pipes with whitelist and transform
- **CORS**: Configured for frontend integration
- **Port**: Defaults to 3000, configurable via PORT env var