# Project Constitution - Sistema de Asistencia Criptografica

**Version:** 1.0  
**Date:** 2025-11-24  
**Status:** Ratified

---

## Preamble

This constitution establishes the fundamental principles, boundaries, and governance rules for the Cryptographic Attendance System project. It defines what the project IS and what limits it must respect, not how it is implemented.

Implementation details belong in technical documentation, not in this constitution.

---

## Article 1: Project Identity and Purpose

### 1.1 Name and Ownership

The project is named **Sistema de Asistencia con Autenticacion Criptografica**, owned by **CMCFL**.

### 1.2 Mission

To provide a university attendance validation system that eliminates fraud through cryptographic verification of physical presence.

### 1.3 Core Values

1. **Security First** - Cryptographic authentication over convenience
2. **Host System Integration** - Operate as a module within the existing PHP server
3. **Simplicity** - Clear, maintainable implementations over clever solutions
4. **Modularity** - Independent components with strict boundaries

---

## Article 2: Architectural Principles

### 2.1 Modular Monolith

The system SHALL be organized as a modular monolith, NOT as microservices. All business logic resides in a single deployable unit with clear internal module boundaries.

### 2.2 Vertical Slicing

Each module SHALL be self-contained with its own domain, application, infrastructure, and presentation layers. Cross-module dependencies are prohibited except through defined interfaces.

### 2.3 Separation of Concerns

The system SHALL maintain strict separation between:

- **Host System** - Authentication, proxying, user/course data (PHP server)
- **Attendance Module** - Cryptographic validation logic (Node.js)
- **Persistence** - Attendance and enrollment data (PostgreSQL)
- **Ephemeral State** - Cache and sessions (Valkey)

### 2.4 Boot Order Invariant

The application bootstrap SHALL follow this order without exception:

1. Infrastructure
2. Middlewares
3. Dependency Injection
4. Backend Modules
5. Frontend Plugin (last)

---

## Article 3: Technology Boundaries

### 3.1 Permitted Technologies

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Host System | PHP 7.4 + Apache 2.4 | Production server (not modifiable) |
| Module Frontend | TypeScript + Vite | Modern development experience |
| Module Backend | Node.js 20 LTS + Fastify | Performance and WebSocket support |
| Relational Data | PostgreSQL | ACID compliance, complex queries |
| Ephemeral Data | Valkey | TTL-based cache, session state |
| Containers | Podman | Rootless container execution |

### 3.2 Technology Constraints

1. The host machine SHALL NOT contain npm; all package management occurs inside containers
2. Container orchestration SHALL use `podman compose` (not `podman-compose`)
3. TypeScript SHALL be used in strict mode for all new code
4. The PHP host system operates at version 7.4; the module SHALL NOT require modifications to it

---

## Article 4: Container Principles

### 4.1 Container Roles

The system SHALL operate with exactly four container types:

| Role | Responsibility |
|------|----------------|
| PHP Service | Host environment + integration module (deployable to production) |
| Node Service | Attendance module; business logic, WebSocket, API |
| PostgreSQL | Persistent relational data |
| Valkey | Ephemeral data with TTL |

### 4.2 PHP Container Dual Purpose

The PHP container serves two purposes:

1. **Environment Simulation** - Replicates the production PHP server conditions (Apache, PHP 7.4, proxy rules)
2. **Integration Module Development** - Contains the actual PHP code (`asistencia-node-integration/`) that will be deployed to the production server

The integration module code is production-ready and will be copied to the university server.

### 4.3 Integration Points

Communication between PHP host and Node module occurs through defined endpoints:

| Direction | Mechanism | Purpose |
|-----------|-----------|---------|
| PHP to Node | HTTP API (`/minodo-api/*`) | Data queries, enrollment operations |
| PHP to Node | WebSocket proxy (`/asistencia/ws`) | Real-time QR projection |
| Node to PHP | JWT validation | User authentication verification |

### 4.4 Network Isolation

1. In production, ONLY the PHP service SHALL be exposed to external networks
2. All other services SHALL communicate exclusively through internal container networks
3. Database ports SHALL NEVER be exposed in production

### 4.5 Environment Separation

The system SHALL support two distinct environments:

- **Development** - Hot reload, exposed debug ports, mounted volumes
- **Production** - Optimized builds, minimal exposure, resource limits

---

## Article 5: Data Principles

### 5.1 Data Domain Separation

The system SHALL maintain two distinct data domains:

1. **Enrollment Domain** - Device registration and cryptographic credentials
2. **Attendance Domain** - Session validation and results

These domains SHALL have separate PostgreSQL schemas and SHALL NOT share tables.

### 5.2 Data Ownership

- User and course data remains in the PHP host system database
- Cryptographic enrollment and attendance data resides in PostgreSQL schemas owned by the Node module
- Ephemeral state (QR metadata, challenges) resides in Valkey with appropriate TTL

### 5.3 Migration Strategy

Database schema changes SHALL be managed through versioned migration scripts executed automatically on container initialization.

---

## Article 6: Security Principles

### 6.1 Authentication Separation

- The PHP host system SHALL emit JWT tokens for authenticated users
- The Node module SHALL validate JWT tokens but NEVER emit them
- Both systems SHALL share signing secrets via environment variables

### 6.2 Defense in Depth

1. Apache proxy as single entry point
2. JWT validation on all protected endpoints
3. WebSocket authentication via handshake
4. Rate limiting on all public endpoints
5. Non-root container execution

### 6.3 Secret Management

- Secrets SHALL be injected via environment variables
- Default secrets SHALL be clearly marked as "change in production"
- Secrets SHALL NEVER be committed to version control

---

## Article 7: Development Governance

### 7.1 Code Standards

1. Comments SHALL be concise and pertinent
2. Emojis and emoticons SHALL NOT appear in code or comments
3. Implementations SHALL follow established patterns within each module
4. New patterns require explicit justification

### 7.2 Workflow Requirements

1. Verify repository state with `git status` before starting work
2. Create feature branches for all non-trivial changes
3. Test functionality before marking tasks complete
4. Commits SHALL have descriptive messages
5. Containers SHALL be rebuilt when dependencies change

### 7.3 Module Migration Rules

When moving functionality between modules:

1. Transfer SHALL be complete (no partial migrations)
2. Cross-module integration SHALL NOT be introduced
3. Both source and target modules SHALL remain independently functional

---

## Article 8: Documentation Hierarchy

### 8.1 Document Types

| Document | Purpose | Changes |
|----------|---------|---------|
| Constitution | Principles and boundaries | Requires deliberation |
| Technical Specs | Detailed design decisions | As needed |
| daRulez.md | Development rules | Team consensus |
| README | Quick start and usage | Freely updated |

### 8.2 Specification Location

Technical specifications SHALL reside in `documents/` organized by topic. Implementation details belong there, not in this constitution.

---

## Article 9: Amendment Process

### 9.1 Constitutional Changes

Changes to this constitution require:

1. Clear justification for why current principles are insufficient
2. Assessment of impact on existing implementation
3. Documentation of the change rationale

### 9.2 Immutable Principles

The following principles SHALL NOT be amended:

1. Modular monolith architecture
2. PHP/Node separation of concerns
3. Security-first approach
4. Vertical slicing pattern

---

## Signatories

This constitution represents the fundamental agreement on how the project shall be developed and maintained.

**Ratified:** 2025-11-24  
**Branch:** feature/database-infrastructure
