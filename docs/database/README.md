# Database Documentation Index

## Overview

This directory contains comprehensive documentation for the Agave database module, including schema definitions, optimization guides, and feature-specific documentation.

**Current Schema Version:** v3.1.0
**Last Updated:** January 2026
**Authentication:** Firebase Auth with OAuth2 and Email Verification

---

## Quick Start by Role

### New Developer
Start here to understand the database structure and get your environment running:

1. **[Database Setup Guide](./setup.md)** - Complete setup instructions, migrations, and environment configuration
2. **[Schema Documentation](./schema.md)** - Complete v3.1 schema reference with all tables, relationships, and constraints
3. **[Schema Visualization](./schema-visualization.md)** - Visual diagrams and entity relationships

### Database Administrator / DevOps
Focus on performance, optimization, and operational aspects:

1. **[Connection Pool Implementation](./CONNECTION-POOL-IMPLEMENTATION.md)** - Production-ready pool configuration and monitoring
2. **[Indexes Documentation](./indexes.md)** - Index strategy, performance analysis, and optimization guidelines
3. **[Triggers Documentation](./triggers.md)** - Automated business logic and data integrity triggers

### Feature Developer
Understand specific domain features and their database implementation:

1. **[Payment Management System](./payment-management.md)** - Period-based payment processing (v3.0+)
2. **Schema Documentation** sections on specific entities (users, houses, transactions, etc.)

---

## Documentation by Purpose

### Reference Documentation
Core schema and structure documentation:

| Document | Purpose | Audience |
|----------|---------|----------|
| [schema.md](./schema.md) | Complete v3.1 database schema reference | All developers |
| [schema-visualization.md](./schema-visualization.md) | Visual entity relationship diagrams | All developers |
| [triggers.md](./triggers.md) | Business logic triggers and automation | Backend developers |
| [indexes.md](./indexes.md) | Index definitions and query optimization | Backend/DBA |

### Setup & Configuration
Getting the database running:

| Document | Purpose | Audience |
|----------|---------|----------|
| [setup.md](./setup.md) | Complete database setup and migration guide | New developers, DevOps |
| [CONNECTION-POOL-IMPLEMENTATION.md](./CONNECTION-POOL-IMPLEMENTATION.md) | Production pool configuration | DevOps, Backend developers |
| [restore-production-to-staging.md](./restore-production-to-staging.md) | Restore production backup to staging environment | DevOps, QA |

### Feature-Specific Documentation
Domain-specific database implementations:

| Document | Purpose | Audience |
|----------|---------|----------|
| [payment-management.md](./payment-management.md) | Period-based payment system (v3.0+) | Feature developers |

---

## Common Tasks

### I need to...

**...set up the database for the first time**
→ Follow [setup.md](./setup.md) - Complete step-by-step guide with migrations

**...understand the complete schema**
→ Read [schema.md](./schema.md) - Full v3.1 schema with all tables and relationships

**...visualize entity relationships**
→ See [schema-visualization.md](./schema-visualization.md) - Mermaid diagrams and visual guides

**...optimize query performance**
→ Check [indexes.md](./indexes.md) - Index strategy and performance guidelines

**...configure connection pooling**
→ Implement [CONNECTION-POOL-IMPLEMENTATION.md](./CONNECTION-POOL-IMPLEMENTATION.md) - Production-ready configuration

**...understand automated triggers**
→ Review [triggers.md](./triggers.md) - Business logic and data integrity automation

**...work with payment periods**
→ Study [payment-management.md](./payment-management.md) - Period-based payment system

**...restore production data to staging**
→ Follow [restore-production-to-staging.md](./restore-production-to-staging.md) - Safe restoration with automatic backup

**...trace schema evolution**
→ See "Version History" section in [schema.md](./schema.md) - Complete changelog from v1.0 to v3.1

---

## Schema Version History

| Version | Release Date | Key Changes | Documentation |
|---------|--------------|-------------|---------------|
| v3.1 | December 2025 | Manual validation with audit trail | [schema.md](./schema.md) |
| v3.0 | November 2025 | Payment management system (periods, transactions) | [payment-management.md](./payment-management.md) |
| v2.0 | October 2025 | Bank reconciliation features | [schema.md](./schema.md) |
| v1.0 | Initial | Core entities (users, houses, transactions) | [schema.md](./schema.md) |

For complete version changelog with SQL migration scripts, see the "Version History" section in [schema.md](./schema.md).

---

## Related Documentation

### Outside Database Module

- **Payment Management Migrations**: `docs/features/payment-management/MIGRATIONS.md`
- **Bank Reconciliation Setup**: `docs/features/bank-reconciliation/SETUP-USUARIO-SISTEMA.md`
- **TypeORM Entities**: `src/shared/database/entities/`

### Deprecated Files (Removed January 2026)

The following files have been removed as their content was superseded:

- `SCHEMA-UPDATES-V2.md` → Consolidated into schema.md version history
- `SCHEMA-UPDATES-V3.md` → Consolidated into schema.md version history
- `connection-pool-optimization.md` → Superseded by CONNECTION-POOL-IMPLEMENTATION.md

---

## Conventions

### Naming
- Tables: `snake_case` plural (e.g., `users`, `houses`)
- Columns: `snake_case` (e.g., `user_id`, `created_at`)
- Indexes: `idx_tablename_columns` (e.g., `idx_users_email`)
- Constraints: `constraint_tablename_type` (e.g., `fk_houses_user_id`)

### Timestamps
All tables include:
- `created_at TIMESTAMPTZ DEFAULT now()`
- `updated_at TIMESTAMPTZ DEFAULT now()`

Managed automatically via `update_updated_at_column()` trigger.

### Primary Keys
- Prefer `SERIAL` or `BIGSERIAL` for auto-incrementing integer IDs
- Use `UUID` only for user-facing entities requiring global uniqueness
- Named as `id` unless domain-specific (e.g., `record_id` in transactions)

---

## Support

For questions or issues:
1. Check the relevant documentation file above
2. Review TypeORM entities in `src/shared/database/entities/`
3. Consult schema visualization for relationship understanding
4. Review migration history in setup.md

Last updated: January 2026
Contributors: Firebase Auth migration (users.id varchar(128), email_verified fields)
