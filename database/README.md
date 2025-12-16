# Database Directory

## Overview

Este directorio contiene todos los recursos de base de datos para el sistema de Asistencia Criptografica, incluyendo schema consolidado, scripts de inicializacion y datos de prueba.

## Structure

```
database/
├── README.md                    # Esta documentacion
├── init.sh                      # Script de inicializacion automatica
├── migrations/
│   └── 001-schema.sql          # Schema consolidado (v2.0.0)
└── seeds/                       # Datos de prueba (TODO)
    └── test-data.sql
```

## Migraciones Consolidadas

**Version actual**: 2.0.0 (2025-12-16)

El archivo `001-schema.sql` consolida todas las migraciones previas:

- **v1.0.0**: Schema inicial con tablas enrollment y attendance
- **v1.0.1**: Agregada columna `transports` a `enrollment.devices`
- **v1.0.2**: Agregada columna `status` a `enrollment.devices`
- **v2.0.0**: Consolidacion completa en un solo archivo

**Archivos obsoletos eliminados:**
- `001-initial-schema.sql`
- `002-add-transports.sql`
- `003-add-enrollment-status.sql`

## Database Schema

La base de datos consiste en dos schemas principales:

### enrollment Schema

Gestion de dispositivos FIDO2/WebAuthn:

**Tables:**
- `enrollment.devices` - Credenciales y metadata de dispositivos enrolados
- `enrollment.enrollment_history` - Auditoria de eventos de enrollment

**Columnas criticas en devices:**
- `status`: Estado del enrollment (pending, enrolled, revoked)
- `transports`: Array JSON de transports WebAuthn (internal, hybrid, usb, nfc, ble)

### attendance Schema

Gestion de sesiones de asistencia y validaciones:

**Tables:**
- `attendance.sessions` - Sesiones creadas por profesores
- `attendance.registrations` - Registro de estudiantes en sesiones
- `attendance.validations` - Rondas individuales de validacion (FN3)
- `attendance.results` - Resultados consolidados finales

## Automatic Initialization

La base de datos se inicializa automaticamente cuando el contenedor PostgreSQL arranca por primera vez.

### Como funciona

1. Podman monta `./database` a `/docker-entrypoint-initdb.d/` en el contenedor
2. PostgreSQL ejecuta automaticamente archivos `.sql` y `.sh` en orden alfabetico
3. `init.sh` orquesta la ejecucion del schema consolidado
4. Los scripts son idempotentes y pueden ejecutarse multiples veces de forma segura

## Ejecucion de Migraciones

### Desarrollo (Primera vez o Reset)

```bash
# Detener contenedores
podman compose -f compose.dev.yaml down

# Eliminar volumen (CUIDADO: borra todos los datos)
podman volume rm asistencia_postgres-data

# Recrear contenedores (ejecuta init.sh automaticamente)
podman compose -f compose.dev.yaml up -d

# Verificar tablas
podman exec asistencia-db psql -U postgres -d asistencia -c '\dt enrollment.*'
podman exec asistencia-db psql -U postgres -d asistencia -c '\dt attendance.*'
```

### Produccion (Migracion desde version anterior)

Si ya existen datos en produccion:

```bash
# 1. Backup de BD
podman exec asistencia-db pg_dump -U postgres asistencia > backup-$(date +%Y%m%d).sql

# 2. Verificar version actual
podman exec asistencia-db psql -U postgres -d asistencia -c '\d enrollment.devices'

# 3. Si faltan columnas (transports, status), aplicar migraciones manualmente
# (Solo si no se puede recrear el volumen)
```

## Verificacion de Estado

### Verificar schemas

```bash
podman exec asistencia-db psql -U postgres -d asistencia -c \
  "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('enrollment', 'attendance');"
\dn

# List tables in enrollment schema
\dt enrollment.*

# List tables in attendance schema
\dt attendance.*

# Describe a specific table
\d enrollment.devices
\d attendance.sessions
```

### Check Indexes

```bash
# List all indexes in enrollment schema
\di enrollment.*

# List all indexes in attendance schema
\di attendance.*
```

### Rollback Migration

```bash
# Execute rollback script
\i /docker-entrypoint-initdb.d/migrations/001-rollback.sql
```

## Environment Variables

Required environment variables (defined in `.env` or `compose.yaml`):

```bash
POSTGRES_DB=asistencia_db          # Database name
POSTGRES_USER=asistencia           # Superuser name
POSTGRES_PASSWORD=asistencia_pass  # Superuser password
POSTGRES_HOST=postgres             # Container hostname
POSTGRES_PORT=5432                 # Internal port
```

## Migration Scripts

### Naming Convention

Migrations follow the pattern: `NNN-description.sql`
- `NNN` - Sequential number (001, 002, 003, ...)
- `description` - Brief description in kebab-case

**Example:** `001-initial-schema.sql`

### Creating New Migrations

1. Create new file in `migrations/` directory:
   ```bash
   touch database/migrations/002-add-indexes.sql
   ```

2. Write SQL DDL:
   ```sql
   -- Migration: 002-add-indexes.sql
   -- Description: Add performance indexes
   
   CREATE INDEX idx_custom ON enrollment.devices(custom_field);
   ```

3. Create corresponding rollback:
   ```bash
   touch database/migrations/002-rollback.sql
   ```

4. Write rollback SQL:
   ```sql
   -- Rollback: 002-add-indexes.sql
   
   DROP INDEX IF EXISTS enrollment.idx_custom;
   ```

5. Restart database container to apply:
   ```bash
   podman-compose down
   podman-compose up -d
   ```

## Seed Data

Seed data is located in `database/seeds/test-data.sql` (pending implementation).

### Purpose

- Provides sample data for development
- Enables testing without manual data entry
- Includes realistic scenarios for all tables

### Loading Seeds Manually

```bash
# Connect to database
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db

# Execute seed script
\i /docker-entrypoint-initdb.d/seeds/test-data.sql
```

## Normalization

All tables follow **Third Normal Form (3NF)**:

- Every table has a primary key
- All non-key attributes depend only on the primary key
- No transitive dependencies
- Foreign keys enforce referential integrity

**Note:** Some denormalization exists for performance (e.g., course_name in sessions) and is documented in the schema file.

## Testing

### Verify Database Setup

```bash
# Check if schemas exist
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db -c "\dn"

# Count tables in enrollment schema
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'enrollment';"

# Count tables in attendance schema
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'attendance';"
```

### Verify Constraints

```bash
# Attempt invalid insert (should fail)
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "INSERT INTO attendance.sessions (max_rounds) VALUES (20);"
# Expected: ERROR - max_rounds must be between 1 and 10
```

### Verify Indexes are Used

```bash
# Check query plan
podman exec -it asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "EXPLAIN SELECT * FROM enrollment.devices WHERE credential_id = 'test';"
# Should show: Index Scan using idx_devices_credential_id
```

## Troubleshooting

### Database not initializing

**Problem:** Scripts in `/docker-entrypoint-initdb.d/` not executing

**Solution:**
1. Remove the PostgreSQL volume:
   ```bash
   podman volume rm asistencia_postgres-data
   ```
2. Restart the container:
   ```bash
   podman-compose up -d postgres
   ```

### Permission denied on init.sh

**Problem:** `init.sh` is not executable

**Solution:**
```bash
chmod +x database/init.sh
```

### Schema already exists

**Problem:** Migration fails because schemas exist

**Solution:** The `init.sh` script is idempotent and will skip existing schemas automatically.

### Connection refused

**Problem:** Cannot connect to PostgreSQL

**Solution:**
1. Check container is running:
   ```bash
   podman ps | grep postgres
   ```
2. Check logs:
   ```bash
   podman logs asistencia-postgres
   ```
3. Verify environment variables:
   ```bash
   podman exec asistencia-postgres env | grep POSTGRES
   ```

## Performance Considerations

### Indexes

All tables have appropriate indexes for common queries:
- Primary keys (automatic B-tree indexes)
- Foreign keys (explicit indexes)
- Frequently filtered columns (status, timestamps)
- Partial indexes for boolean fields (e.g., `is_active = TRUE`)

### Query Optimization

Use `EXPLAIN ANALYZE` to verify index usage:

```sql
EXPLAIN ANALYZE
SELECT * FROM attendance.registrations
WHERE session_id = 1 AND status = 'active';
```

## References

- [Migration 001: Initial Schema](./migrations/001-initial-schema.sql)
- [Schema Specification](../documents/03-especificaciones-tecnicas/05-esquema-base-datos.md)
- [Architecture Documentation](../documents/03-especificaciones-tecnicas/01-arquitectura-general.md)

## Maintenance

### Backup Database

```bash
# Dump entire database
podman exec asistencia-postgres pg_dump -U asistencia asistencia_db > backup.sql

# Dump specific schema
podman exec asistencia-postgres pg_dump -U asistencia -n enrollment asistencia_db > enrollment_backup.sql
```

### Restore Database

```bash
# Restore from dump
podman exec -i asistencia-postgres psql -U asistencia asistencia_db < backup.sql
```

### Monitor Database Size

```bash
# Check database size
podman exec asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "SELECT pg_size_pretty(pg_database_size('asistencia_db'));"

# Check table sizes
podman exec asistencia-postgres psql -U asistencia -d asistencia_db \
  -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables WHERE schemaname IN ('enrollment', 'attendance') ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

## Contributing

When adding new migrations:

1. Follow the naming convention
2. Include comments explaining the purpose
3. Create corresponding rollback script
4. Test in development environment first
5. Document any breaking changes
6. Update this README if needed

## License

Internal use only - Asistencia Project
