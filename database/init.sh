#!/bin/bash
# ============================================================================
# Database Initialization Script
# ============================================================================
# Description: Executes all migration scripts in order for PostgreSQL
# Usage: Automatically executed by PostgreSQL container on first run
# Location: Mounted in /docker-entrypoint-initdb.d/
# ============================================================================

set -e  # Exit on error

echo "========================================"
echo "Asistencia DB - Initialization Starting"
echo "========================================"
echo "Database: $POSTGRES_DB"
echo "User: $POSTGRES_USER"
echo "========================================"

# Directory containing migration scripts
MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "ERROR: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Count migration files
MIGRATION_COUNT=$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | wc -l)
echo "Found $MIGRATION_COUNT migration file(s)"

# Execute migrations in numerical order
echo ""
echo "Executing migrations..."
echo "----------------------------------------"

for migration in $(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort); do
    filename=$(basename "$migration")

    echo ""
    echo "→ Executing: $filename"

    # Check if schema already exists (idempotency check)
    if [[ "$filename" == *"initial-schema"* ]]; then
        SCHEMA_EXISTS=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
            "SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name IN ('enrollment', 'attendance');")

        if [ "$SCHEMA_EXISTS" -gt 0 ]; then
            echo "  ⚠ Schemas already exist, skipping..."
            continue
        fi
    fi

    # Execute the migration
    if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration"; then
        echo "  ✓ Success: $filename"
    else
        echo "  ✗ FAILED: $filename"
        exit 1
    fi
done

echo ""
echo "----------------------------------------"
echo "All migrations completed successfully!"
echo "----------------------------------------"

# Verify schemas were created
echo ""
echo "Verifying database setup..."
ENROLLMENT_EXISTS=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'enrollment');")
ATTENDANCE_EXISTS=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc \
    "SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = 'attendance');")

if [ "$ENROLLMENT_EXISTS" = "t" ] && [ "$ATTENDANCE_EXISTS" = "t" ]; then
    echo "✓ Schema 'enrollment' created"
    echo "✓ Schema 'attendance' created"
else
    echo "⚠ WARNING: Some schemas may not have been created"
fi

echo ""
echo "========================================"
echo "Database Initialization Complete!"
echo "========================================"
