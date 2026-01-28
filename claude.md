# claude.md – NestJS Backend

## Precedence

This file **extends and overrides** rules defined in `/CLAUDE.md` (global level).

In case of conflict, **this file takes precedence**. For global rules not overridden here, refer to `/CLAUDE.md`.

---

## Authority & Scope

This file defines **mandatory rules** for Claude Code when working in this repository.

Claude must:
- Follow this file over any default best practices
- Adapt to existing code and patterns
- Preserve current architecture and contracts

If a suggestion conflicts with this file, **this file always wins**.

---

## Git & Safety Rules

Refer to `/CLAUDE.md` for critical Git rules. **No Git operations are performed** in this project.

---

## Project Context

This is a **NestJS backend** serving:
- A **React frontend**
- A **WhatsApp API integration**

The system processes financial data, documents, and user interactions across multiple channels.

Primary goals:
- Long-term maintainability
- Strict architectural boundaries
- Predictable API contracts

---

## Development Commands

Claude may reference (but not execute):

- `npm run start:dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`

---

## Architecture Overview (MANDATORY)

The project follows a **feature-based NestJS architecture**.

```
src/
├── features/        # Business logic grouped by domain
├── shared/          # Cross-cutting concerns only
└── main.ts
```

Claude must analyze the existing structure before adding new code.

---

## NestJS Architecture Rules (STRICT)

### Controllers

- HTTP / transport layer only
- Validate input and delegate
- No business logic
- No database access

### Services

- Business logic only
- No request / response objects
- No transport-specific concerns

### Repositories

- TypeORM/database access only
- No business rules

❌ Forbidden:
- Controllers calling the database directly
- Services accessing `Request`, `Response`
- Cross-feature imports

---

## Feature-Based Development

Claude must:
- Add logic to an existing feature when applicable
- Create new features only when responsibility is clearly new
- Keep feature boundaries strict

❌ Forbidden:
- Dumping logic into `shared/` without justification
- God-modules or catch-all services

---

## TypeScript Strictness

Refer to `/CLAUDE.md` for strict TypeScript rules. This project **forbids `any` and weak typing** in business logic.

Key additions for NestJS context:
- Use DTOs, interfaces, or domain types
- Reuse domain types and TypeORM entities when possible
- Prefer async/await for all asynchronous logic

---

## DTOs & Validation

- All external input must use DTOs
- DTOs must use `class-validator` and `class-transformer`
- Validation errors must be explicit and meaningful

❌ Forbidden:
- Accepting raw objects from requests
- Skipping validation for convenience

---

## Database & ORM (TypeORM)

- **TypeORM** is the only database access layer
- Entities define the source of truth for persistence
- Migrations are managed via TypeORM

Claude must:
- Use repositories or injected `EntityManager`
- Respect existing entities and relations
- Reuse entities before creating new ones

❌ Forbidden:
- Direct SQL queries unless explicitly instructed
- Bypassing TypeORM abstractions
- Introducing a second ORM or query layer

---

## External Integrations

### Frontend (React)

This API serves a React frontend.

Claude must:
- Preserve response shapes
- Avoid breaking API contracts
- Prefer additive changes

Breaking changes must:
- Be clearly identified
- Include migration notes

---

### WhatsApp API Integration

This backend integrates with **WhatsApp APIs**.

Claude must:
- Treat WhatsApp payloads as external system boundaries
- Validate and normalize incoming data
- Preserve expected message formats

❌ Forbidden:
- Changing payload shapes without explicit instruction
- Mixing WhatsApp logic into unrelated features

---

## AI & OCR Processing

AI providers include:
- Google Vision
- OpenAI
- Vertex AI / Gemini

Claude must:
- Isolate provider-specific logic
- Avoid leaking AI response formats into domain logic
- Normalize outputs before use

---

## Error Handling (MANDATORY)

Claude must:
- Use domain-specific exceptions
- Map errors to meaningful HTTP responses
- Fail loudly and explicitly

❌ Forbidden:
- `throw new Error()`
- Silent failures
- Swallowed exceptions

---

## Testing Expectations

- Services and controllers should be testable
- Prefer unit tests for business logic
- E2E tests validate integrations

Claude must:
- Avoid code that is hard to mock or test
- Follow existing testing patterns

---

## Refactors

When refactoring:
- ❌ Do not change behavior
- ❌ Do not change public contracts
- ✅ Improve clarity and structure
- ✅ Reduce complexity

Claude must explain **why** a refactor improves the code.

---

## Working Mode for Claude

Before coding:
1. Analyze existing features
2. Identify established patterns
3. Propose minimal changes

During coding:
- Small, scoped changes
- Explicit types
- Clear boundaries

After coding:
- Re-evaluate simplicity
- Check architectural compliance

---

## Final Principle

> If a service feels complex, it probably violates a boundary.

Prefer:
- Explicit over clever
- Domain logic over framework magic
- Stability over novelty

