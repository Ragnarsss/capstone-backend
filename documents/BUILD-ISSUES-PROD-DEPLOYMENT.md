# Problemas de Build - Deployment Producción

**Fecha:** 2025-12-18  
**Entorno:** Producción (mantochrisal.cl)  
**Comando:** `podman compose -f compose.yaml -f compose.prod.yaml up --build -d`

## Problema 1: Variable de Entorno Faltante

### Síntoma

```
Build failed: SERVER_MASTER_SECRET is undefined
```

### Causa

El archivo `.env` no incluía la variable `SERVER_MASTER_SECRET` requerida por el servicio Node.js para operaciones criptográficas.

### Solución

Generar secreto aleatorio de 64 bytes:

```bash
echo -e "\n# Server Cryptographic Master Secret\nSERVER_MASTER_SECRET=$(openssl rand -base64 64 | tr -d '\n')" >> .env
```

Resultado: Variable agregada al archivo `.env`

## Problema 2: Errores de Compilación TypeScript

### Síntoma

```
Error: Module '"../../../../shared/ports"' has no exported member 'IQRGenerator'
Error: Module '"../../../../shared/types"' not found
Error: Module '"../../../../enrollment/domain/models"' has no exported member 'Device'
```

Build fallaba en step "RUN npm run build" del Containerfile.

### Causa Raíz

1. No existía `shared/index.ts` para exportar módulos compartidos
2. `enrollment/domain/models.ts` no exportaba la entidad `Device`
3. Archivos de test se incluían en el build de producción

### Solución Aplicada

**Cambio 1:** Crear barrel file para módulos compartidos

Archivo: `node-service/src/shared/index.ts`

```typescript
// Puertos (Ports & Adapters pattern)
export * from "./ports";

// Tipos compartidos
export * from "./types";

// Configuración
export * from "./config";

// Infraestructura compartida
export * from "./infrastructure/valkey";
```

**Cambio 2:** Exportar entidad Device

Archivo: `node-service/src/backend/enrollment/domain/models.ts`

```typescript
// Re-export Device entity
export type {
  Device,
  CreateDeviceDto,
  UpdateCounterDto,
} from "./entities/device.entity";
```

**Cambio 3:** Excluir tests del build de producción

Archivo: `node-service/tsconfig.json`

```json
{
  "exclude": [
    "node_modules",
    "dist",
    "src/frontend",
    "**/__tests__/**",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

### Resultado

Build exitoso. Todos los servicios levantados correctamente:

```
asistencia-postgres  Up (healthy)
asistencia-valkey    Up (healthy)
asistencia-node      Up
asistencia-php       Up
```

## Verificación Post-Deployment

```bash
# Estado de contenedores
podman ps
# Todos los servicios: STATUS = Up

# Logs sin errores críticos
podman logs asistencia-node --tail 50
# [Server] Corriendo en http://0.0.0.0:3000

# Conectividad
curl -I http://localhost:9500/
# HTTP/1.1 200 OK

curl -I http://localhost:9500/asistencia/
# HTTP/1.1 302 Found (redirección correcta)
```

## Archivos Modificados

- `asistencia/.env` - Agregada variable SERVER_MASTER_SECRET
- `node-service/src/shared/index.ts` - Creado barrel file
- `node-service/src/backend/enrollment/domain/models.ts` - Exportado Device
- `node-service/tsconfig.json` - Excluidos tests del build

## Tiempo Total

Aproximadamente 20 minutos desde primer intento de build hasta deployment exitoso.
