 Estructura Correcta de un Proyecto Fastify
Fecha: diciembre  
Proposito: Guia de referencia para estructurar correctamente el backend Node.js con Fastify
---
 . INICIALIZACION DE PROYECTO FASTIFY
 Comparacion: Express vs Fastify
| Aspecto     | Express            | Fastify           |
| --------------- | ----------------------------- | ---------------------------- |
| Filosofia  | Middleware-based, flexible  | Plugin-based, opinionado   |
| Performance | ~k req/s          | ~k req/s (.x más rápido) |
| TypeScript | Requiere configuración manual | First-class support     |
| Validacion | Middleware externo (Joi, etc) | JSON Schema built-in     |
| Async/Await | Soporte basico        | Disenado para async     |
| Logging   | Requiere Winston/Morgan    | Pino integrado        |
 Inicializacion Paso a Paso
 . Crear Proyecto Nuevo
```bash
 Crear directorio
mkdir asistencia-backend
cd asistencia-backend
 Inicializar npm
npm init -y
 Instalar Fastify y dependencias core
npm install fastify
 Instalar TypeScript y herramientas de desarrollo
npm install -D typescript tsx @types/node
 Instalar plugins Fastify comunes
npm install @fastify/cors @fastify/helmet @fastify/rate-limit
 Inicializar TypeScript
npx tsc --init
```
 . Configurar `tsconfig.json`
```json
{
 "compilerOptions": {
  "target": "ES",
  "module": "Node",
  "moduleResolution": "Node",
  "lib": ["ES"],
  "outDir": "./dist",
  "rootDir": "./src",
  "strict": true,
  "esModuleInterop": true,
  "skipLibCheck": true,
  "forceConsistentCasingInFileNames": true,
  "resolveJsonModule": true,
  "declaration": true,
  "declarationMap": true,
  "sourceMap": true,
  "types": ["node"]
 },
 "include": ["src//"],
 "exclude": ["node_modules", "dist", "/.test.ts"]
}
```
 . Configurar `package.json`
```json
{
 "name": "asistencia-backend",
 "version": "..",
 "description": "Backend API para sistema de asistencia",
 "type": "module",
 "main": "dist/index.js",
 "scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "lint": "eslint src --ext .ts",
  "format": "prettier --write \"src//.ts\""
 },
 "dependencies": {
  "fastify": "^..",
  "@fastify/cors": "^..",
  "@fastify/helmet": "^..",
  "@fastify/rate-limit": "^..",
  "@fastify/websocket": "^..",
  "ioredis": "^..",
  "pg": "^..",
  "jsonwebtoken": "^..",
  "otplib": "^.."
 },
 "devDependencies": {
  "@types/jsonwebtoken": "^..",
  "@types/node": "^..",
  "@types/pg": "^..",
  "tsx": "^..",
  "typescript": "^..",
  "vitest": "^..",
  "@vitest/coverage-v": "^..",
  "eslint": "^..",
  "prettier": "^.."
 }
}
```
Nota: `"type": "module"` habilita ES Modules nativos.
---
 . ESTRUCTURA DE CARPETAS RECOMENDADA
 Opcion A: Estructura Simple (Proyectos Pequenos)
```
backend/
+-- src/
|  +-- routes/        Definicion de rutas
|  |  +-- auth.routes.ts
|  |  +-- attendance.routes.ts
|  |  +-- session.routes.ts
|  +-- services/       Logica de negocio
|  |  +-- auth.service.ts
|  |  +-- attendance.service.ts
|  |  +-- session.service.ts
|  +-- repositories/     Acceso a datos
|  |  +-- user.repository.ts
|  |  +-- session.repository.ts
|  +-- middleware/      Middlewares custom
|  |  +-- auth.middleware.ts
|  |  +-- error-handler.ts
|  +-- config/        Configuracion
|  |  +-- database.ts
|  |  +-- redis.ts
|  +-- types/        TypeScript types
|  |  +-- index.ts
|  +-- app.ts        Configuracion Fastify
|  +-- index.ts       Entry point
+-- tests/
|  +-- unit/
|  +-- integration/
+-- tsconfig.json
+-- package.json
+-- .env.example
+-- README.md
```
 Opcion B: Estructura DDD (Proyectos Grandes - RECOMENDADO)
```
backend/
+-- src/
|  +-- modules/           Modulos de dominio
|  |  +-- auth/
|  |  |  +-- domain/       Entidades y value objects
|  |  |  |  +-- user.entity.ts
|  |  |  |  +-- user-id.vo.ts
|  |  |  |  +-- jwt-token.vo.ts
|  |  |  +-- application/    Casos de uso
|  |  |  |  +-- login.usecase.ts
|  |  |  |  +-- verify-token.usecase.ts
|  |  |  +-- infrastructure/   Implementaciones
|  |  |  |  +-- jwt.service.ts
|  |  |  |  +-- user.repository.ts
|  |  |  +-- presentation/    Controllers/Routes
|  |  |    +-- auth.controller.ts
|  |  |
|  |  +-- attendance/
|  |  |  +-- domain/
|  |  |  +-- application/
|  |  |  +-- infrastructure/
|  |  |  +-- presentation/
|  |  |
|  |  +-- session/
|  |    +-- domain/
|  |    +-- application/
|  |    +-- infrastructure/
|  |    +-- presentation/
|  |
|  +-- shared/           Codigo compartido
|  |  +-- infrastructure/
|  |  |  +-- database/
|  |  |  |  +-- postgres-pool.ts
|  |  |  +-- cache/
|  |  |    +-- redis-client.ts
|  |  +-- middleware/
|  |  |  +-- error-handler.ts
|  |  |  +-- auth-guard.ts
|  |  |  +-- logger.middleware.ts
|  |  +-- types/
|  |    +-- index.ts
|  |
|  +-- config/           Configuracion centralizada
|  |  +-- index.ts
|  |
|  +-- plugins/          Fastify plugins
|  |  +-- cors.plugin.ts
|  |  +-- helmet.plugin.ts
|  |  +-- rate-limit.plugin.ts
|  |
|  +-- app.ts           Composicion de Fastify
|  +-- index.ts          Entry point
|
+-- tests/
|  +-- unit/
|  |  +-- auth/
|  |  +-- attendance/
|  |  +-- session/
|  +-- integration/
|  +-- helpers/
|    +-- test-helpers.ts
|
+-- scripts/            Scripts utiles
|  +-- migrate.ts
|  +-- seed.ts
|
+-- tsconfig.json
+-- vitest.config.ts
+-- package.json
+-- .env.example
+-- .eslintrc.json
+-- .prettierrc
+-- Containerfile
+-- README.md
```
Esta es la estructura que deberias usar para el proyecto de asistencia.
---
 . ARCHIVOS PRINCIPALES
 `src/index.ts` (Entry Point)
```typescript
import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config/index.js";
/
 Entry point de la aplicacion
 /
async function start() {
 const app = await createApp();
 try {
  const address = await app.listen({
   port: config.port,
   host: config.host,
  });
  app.log.info(`Server listening on ${address}`);
 } catch (err) {
  app.log.error(err);
  process.exit();
 }
}
start();
```
 `src/app.ts` (Configuracion Fastify)
```typescript
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { config } from "./config/index.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
// Importar modulos
import { authModule } from "./modules/auth/presentation/auth.controller.js";
import { attendanceModule } from "./modules/attendance/presentation/attendance.controller.js";
import { sessionModule } from "./modules/session/presentation/session.controller.js";
/
 Crea y configura la instancia de Fastify
 /
export async function createApp(): Promise<FastifyInstance> {
 const app = Fastify({
  logger: {
   level: config.logLevel,
   transport: config.isDevelopment
    {
      target: "pino-pretty",
      options: {
       translateTime: "HH:MM:ss Z",
       ignore: "pid,hostname",
      },
     }
    : undefined,
  },
 });
 // Plugins globales
 await app.register(helmet, {
  contentSecurityPolicy: config.isProduction,
 });
 await app.register(cors, {
  origin: config.corsOrigins,
  credentials: true,
 });
 await app.register(rateLimit, {
  max: ,
  timeWindow: " minute",
 });
 await app.register(websocket);
 // Error handler global
 app.setErrorHandler(errorHandler);
 // Health check
 app.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() };
 });
 // Registrar modulos
 await app.register(authModule, { prefix: "/api/auth" });
 await app.register(attendanceModule, { prefix: "/api/attendance" });
 await app.register(sessionModule, { prefix: "/api/session" });
 return app;
}
```
 `src/config/index.ts` (Configuracion)
```typescript
import { config as dotenvConfig } from "dotenv";
dotenvConfig();
export const config = {
 // Server
 port: parseInt(process.env.PORT || "", ),
 host: process.env.HOST || "...",
 // Environment
 nodeEnv: process.env.NODE_ENV || "development",
 isDevelopment: process.env.NODE_ENV === "development",
 isProduction: process.env.NODE_ENV === "production",
 // Logging
 logLevel: process.env.LOG_LEVEL || "info",
 // CORS
 corsOrigins: process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:",
 ],
 // Database
 database: {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "", ),
  name: process.env.DB_NAME || "asistencia",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || "", ),
 },
 // Redis/Valkey
 redis: {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "", ),
  password: process.env.REDIS_PASSWORD,
 },
 // JWT
 jwt: {
  secret: process.env.JWT_SECRET || "change-me-in-production",
  expiresIn: process.env.JWT_EXPIRES_IN || "m",
 },
} as const;
// Validar configuración critica en produccion
if (config.isProduction) {
 if (config.jwt.secret === "change-me-in-production") {
  throw new Error("JWT_SECRET must be set in production");
 }
}
```
 Ejemplo de Modulo: `src/modules/auth/presentation/auth.controller.ts`
```typescript
import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { AuthService } from "../application/auth.service.js";
import { LoginSchema, LoginRequest } from "./auth.schemas.js";
/
 Plugin de autenticacion
 /
export const authModule: FastifyPluginAsync = async (app: FastifyInstance) => {
 const authService = new AuthService();
 // POST /api/auth/login
 app.post<{ Body: LoginRequest }>(
  "/login",
  {
   schema: {
    body: LoginSchema,
    response: {
     : {
      type: "object",
      properties: {
       success: { type: "boolean" },
       token: { type: "string" },
       expiresIn: { type: "number" },
      },
     },
    },
   },
  },
  async (request, reply) => {
   const { username, password } = request.body;
   const result = await authService.login(username, password);
   return reply.code().send(result);
  }
 );
 // GET /api/auth/verify
 app.get(
  "/verify",
  {
   onRequest: [app.authenticate], // Middleware de autenticacion
  },
  async (request, reply) => {
   // request.user disponible por el middleware
   return reply.code().send({
    success: true,
    user: request.user,
   });
  }
 );
};
```
---
 . COMPARACION: ACTUAL (INCORRECTO) VS CORRECTO
 Actual (Mezclado con Vite) ?
```
node-service/
+-- src/
|  +-- backend/         Backend Fastify
|  |  +-- auth/
|  |  +-- attendance/
|  |  +-- session/
|  +-- frontend/        Frontend Vite
|  |  +-- features/
|  |  +-- shared/
|  +-- shared/         ?Backend o Frontend?
|  +-- middleware/       Solo backend
|  +-- plugins/
|  |  +-- frontend-plugin.ts  Plugin para servir frontend
|  +-- app.ts          Backend + plugin frontend
|  +-- index.ts
+-- vite.config.ts        Configuracion Vite (frontend)
+-- tsconfig.json        TypeScript (mezclado)
+-- package.json         Dependencias mezcladas
 Scripts confusos
{
 "scripts": {
  "dev": "concurrently 'npm:dev:backend' 'npm:dev:frontend'",
  "dev:backend": "tsx watch src/index.ts",
  "dev:frontend": "vite",
  "build": "npm run build:backend && npm run build:frontend",
  "build:backend": "tsc",
  "build:frontend": "vite build"
 }
}
```
Problemas:
- Vite no sirve para backend
- Dependencias mezcladas (Fastify + Vite + @zxing/browser)
- `src/shared/` ambiguo (código backend usado en frontend?)
- Build process complejo
- Testing confuso (?que esta probando Vitest?)
 Correcto (Separado) ?
```
backend/             Proyecto Fastify puro
+-- src/
|  +-- modules/        Modulos de dominio
|  |  +-- auth/
|  |  +-- attendance/
|  |  +-- session/
|  +-- shared/         Infraestructura backend
|  |  +-- database/
|  |  +-- cache/
|  |  +-- middleware/
|  +-- config/
|  +-- app.ts         Solo backend
|  +-- index.ts
+-- tests/
+-- tsconfig.json        Solo backend
+-- package.json        Solo deps backend
frontend/            Proyecto Vite puro
+-- src/
|  +-- features/
|  |  +-- qr-host/
|  |  +-- qr-reader/
|  +-- shared/         Utils frontend
|    +-- auth/
|    +-- websocket/
|    +-- services/
+-- vite.config.ts
+-- tsconfig.json        Solo frontend
+-- package.json        Solo deps frontend
 Scripts simples backend
{
 "scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
 }
}
 Scripts simples frontend
{
 "scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
 }
}
```
Ventajas:
- Cada proyecto con su proposito claro
- Dependencias especificas
- Build independiente
- Testing independiente
- Deploy independiente
- Escalabilidad independiente
---
 . DESARROLLO Y PRODUCCION
 Desarrollo
Backend:
```bash
cd backend
npm run dev
 tsx watch detecta cambios y reinicia automaticamente
 Servidor corre en http://localhost:
```
Frontend:
```bash
cd frontend
npm run dev
 Vite dev server con HMR
 Frontend corre en http://localhost:
```
Integracion (con Docker Compose):
```yaml
 compose.dev.yaml
services:
 backend:
  build: ./backend
  volumes:
   - ./backend/src:/app/src Hot reload
  command: npm run dev
  ports:
   - ":"
 frontend:
  build: ./frontend
  volumes:
   - ./frontend/src:/app/src Hot reload
  command: npm run dev
  ports:
   - ":"
```
 Produccion
Backend:
```bash
 Build
cd backend
npm run build
 Output: dist/
 Containerfile
FROM node:-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
FROM node:-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 
CMD ["node", "dist/index.js"]
```
Frontend:
```bash
 Build
cd frontend
npm run build
 Output: dist/
 Containerfile (Nginx)
FROM node:-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 
CMD ["nginx", "-g", "daemon off;"]
```
Orquestacion:
```yaml
 compose.prod.yaml
services:
 backend:
  image: asistencia-backend:latest
  environment:
   - NODE_ENV=production
   - PORT=
  ports:
   - ":"
  restart: unless-stopped
 frontend:
  image: asistencia-frontend:latest
  ports:
   - ":"
  restart: unless-stopped
```
---
 . TESTING
 Backend (Vitest)
```typescript
// tests/unit/auth/auth.service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "../../../src/modules/auth/application/auth.service.js";
describe("AuthService", () => {
 let authService: AuthService;
 beforeEach(() => {
  authService = new AuthService();
 });
 it("should generate valid JWT token", async () => {
  const result = await authService.login("user@test.com", "password");
  expect(result.success).toBe(true);
  expect(result.token).toBeDefined();
  expect(result.expiresIn).toBe();
 });
 it("should reject invalid credentials", async () => {
  await expect(authService.login("user@test.com", "wrong")).rejects.toThrow(
   "Invalid credentials"
  );
 });
});
```
 Frontend (Vitest + Playwright)
```typescript
// frontend/tests/qr-reader.test.ts
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import QRReader from "../src/features/qr-reader/QRReader.vue";
describe("QRReader", () => {
 it("should render scanner", () => {
  const wrapper = mount(QRReader);
  expect(wrapper.find(".scanner").exists()).toBe(true);
 });
});
```
---
 . MIGRACION DEL PROYECTO ACTUAL
 Paso : Crear Backend Independiente
```bash
mkdir backend
cd backend
npm init -y
 Copiar código backend
cp -r ../node-service/src/backend/ src/modules/
cp -r ../node-service/src/shared/infrastructure src/shared/
cp -r ../node-service/src/middleware src/middleware/
cp ../node-service/src/app.ts src/
cp ../node-service/src/index.ts src/
 Instalar solo dependencias backend
npm install fastify @fastify/websocket ioredis pg jsonwebtoken otplib qrcode
npm install -D typescript tsx @types/node vitest
```
 Paso : Limpiar Codigo Backend
```typescript
// src/app.ts - ANTES (con plugin frontend)
import { frontendPlugin } from "./plugins/frontend-plugin.js"; // Eliminar
await app.register(frontendPlugin, {
 // Eliminar
 isDevelopment: config.isDevelopment,
});
// src/app.ts - DESPUES (solo backend)
// Plugin frontend eliminado ?
// Solo rutas API
```
 Paso : Actualizar Imports
```typescript
// ANTES
import { PostgresPool } from "../shared/infrastructure/database/postgres-pool.js";
// DESPUES (ajustar paths)
import { PostgresPool } from "../../shared/infrastructure/database/postgres-pool.js";
```
 Paso : Crear Frontend Independiente
```bash
mkdir frontend
cd frontend
npm init -y
 Copiar código frontend
cp -r ../node-service/src/frontend/ src/
cp ../node-service/vite.config.ts .
 Instalar solo dependencias frontend
npm install @zxing/browser @zxing/library
npm install -D vite typescript
```
 Paso : Actualizar Vite Config
```typescript
// frontend/vite.config.ts
import { defineConfig } from "vite";
import path from "path";
export default defineConfig({
 root: "src",
 base: "/asistencia/",
 build: {
  outDir: "../dist",
  emptyOutDir: true,
  rollupOptions: {
   input: {
    "qr-host": path.resolve(__dirname, "src/features/qr-host/index.html"),
    "qr-reader": path.resolve(
     __dirname,
     "src/features/qr-reader/index.html"
    ),
   },
  },
 },
 server: {
  proxy: {
   "/asistencia/api": {
    target: "http://localhost:",
    changeOrigin: true,
   },
   "/asistencia/ws": {
    target: "ws://localhost:",
    ws: true,
   },
  },
 },
});
```
---
 . CONCLUSION
 DO (Hacer)
- Separar backend y frontend en proyectos independientes
- Usar TypeScript en ambos proyectos
- Build independiente (tsc para backend, vite para frontend)
- Deploy independiente (Node.js para backend, Nginx para frontend)
- Testing independiente (Vitest para ambos, Playwright para EE frontend)
- Estructura DDD para backend con modulos
 DON'T (No Hacer)
- No usar Vite para backend
- No mezclar dependencias de backend y frontend
- No usar `src/shared/` ambiguo entre proyectos
- No compilar backend con Vite
- No servir frontend desde Fastify en produccion
- No usar `concurrently` para scripts de desarrollo
 Resultado Final
```
asistencia/
+-- backend/      Fastify puro - API REST + WebSocket
+-- frontend/     Vite puro - UI React/Vue
+-- php-service/    PHP legacy
+-- compose.yaml    Orquestacion
```
Cada proyecto con su responsabilidad, tecnologia, y ciclo de vida independiente.
