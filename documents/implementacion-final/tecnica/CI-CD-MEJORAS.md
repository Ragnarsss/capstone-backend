# Mejoras CI/CD - Basadas en Issues Día 3

**Fecha:** 2026-01-04  
**Contexto:** Análisis post-mortem de bloqueadores Día 3 para prevenir recurrencia en CI/CD

---

## Issues Identificados del Día 3

### Issue 1: TypeScript ESM Module Resolution

**Impacto:** 3h debugging, bloqueó despliegue
**Causa raíz:** Build con tsc genera archivos sin extensiones .js, incompatible con ESM
**Solución implementada:** tsx runtime (skip build)

### Issue 2: Disk Space Insufficiency

**Impacto:** Build failures sin mensaje claro
**Causa raíz:** 97% disk usage, podman cache acumulado
**Solución implementada:** Manual prune (2.6GB liberados)

### Issue 3: PostgreSQL Wrong Credentials

**Impacto:** 15min debugging, backend no iniciaba
**Causa raíz:** Inconsistencia entre .env y configuración real
**Solución implementada:** Corrección manual credenciales

### Issue 4: Apache Configuration Complexity

**Impacto:** 2h setup, 3449 líneas hawaii.conf legacy
**Causa raíz:** Configuración no documentada, sin validación
**Solución implementada:** hawaii.conf simplificado (50 líneas)

---

## Problemas Actuales del Pipeline

### 1. Build Job Incompatible con Producción

**Problema:**

```yaml
- name: Build backend
  working-directory: backend
  run: npm run build # <-- Compila con tsc
```

**Impacto:** CI valida código que NO se usa en producción (usamos tsx, no tsc)

**Evidencia:**

- Producción: `npm start` → tsx src/index.ts (no build)
- CI: npm run build → tsc (genera dist/ que no usamos)
- Resultado: CI puede pasar pero producción fallar

**Solución propuesta:**

```yaml
- name: Validar runtime tsx
  working-directory: backend
  run: |
    # Iniciar backend con tsx
    timeout 10s npm start || code=$?
    if [ $code -eq 124 ]; then
      echo "Backend inició correctamente con tsx"
      exit 0
    else
      echo "Backend falló al iniciar"
      exit 1
    fi
```

---

### 2. Sin Validación de Disk Space

**Problema:** CI no detecta problemas de disk space hasta que build falla

**Impacto:** Failures inesperados, debugging difícil

**Solución propuesta:**

```yaml
disk-check:
  name: Verificar Disk Space
  runs-on: ubuntu-latest
  steps:
    - name: Check disk usage
      run: |
        df -h

        usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

        if [ "$usage" -gt 80 ]; then
          echo "WARNING: Disk usage at ${usage}%"
          
          # Cleanup Docker/Podman
          docker system prune -af --volumes || true
          podman system prune -af --volumes || true
          
          # Re-check
          usage_after=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
          echo "Disk usage after cleanup: ${usage_after}%"
          
          if [ "$usage_after" -gt 85 ]; then
            echo "ERROR: Disk space crítico después de cleanup"
            exit 1
          fi
        fi
```

---

### 3. Sin Tests E2E en CI

**Problema:** CI no valida flujos completos profesor/estudiante

**Impacto:** Regresiones detectadas solo en staging/producción

**Solución propuesta:**

```yaml
test-e2e:
  name: Tests E2E Playwright
  runs-on: ubuntu-latest
  needs: [test-node]
  services:
    postgres:
      image: postgres:18-alpine
      env:
        POSTGRES_DB: asistencia_test
        POSTGRES_USER: test_user
        POSTGRES_PASSWORD: test_password
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432

    valkey:
      image: valkey/valkey:7-alpine
      ports:
        - 6379:6379

  steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"
        cache-dependency-path: backend/package-lock.json

    - name: Instalar dependencias
      working-directory: backend
      run: npm ci

    - name: Instalar Playwright
      working-directory: backend
      run: npx playwright install --with-deps chromium

    - name: Iniciar backend
      working-directory: backend
      run: |
        npm start &

        # Wait for backend ready
        timeout 30 bash -c 'until curl -s http://localhost:3000/healthz; do sleep 2; done'
      env:
        JWT_SECRET: test_secret_e2e
        POSTGRES_HOST: localhost
        POSTGRES_PORT: 5432
        POSTGRES_DB: asistencia_test
        POSTGRES_USER: test_user
        POSTGRES_PASSWORD: test_password
        VALKEY_HOST: localhost
        VALKEY_PORT: 6379

    - name: Ejecutar tests E2E
      working-directory: backend
      run: npm run test:e2e

    - name: Upload Playwright report
      if: failure()
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report
        path: backend/playwright-report/
        retention-days: 30
```

---

### 4. Sin Validación de Variables de Entorno

**Problema:** Credenciales incorrectas causan failures en runtime, no en CI

**Impacto:** Issue #3 (PostgreSQL credentials) no se hubiera detectado en CI

**Solución propuesta:**

```yaml
validate-env:
  name: Validar Configuración
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Validar .env.example vs código
      run: |
        # Extraer variables requeridas del código
        required_vars=$(grep -rh "process.env\." backend/src/ | \
                        sed 's/.*process\.env\.\([A-Z_]*\).*/\1/' | \
                        sort -u)

        # Verificar que existen en .env.example
        missing_vars=""
        for var in $required_vars; do
          if ! grep -q "^${var}=" backend/.env.example; then
            missing_vars="${missing_vars}\n- ${var}"
          fi
        done

        if [ -n "$missing_vars" ]; then
          echo "ERROR: Variables faltantes en .env.example:"
          echo -e "$missing_vars"
          exit 1
        fi

        echo "OK: Todas las variables están documentadas"

    - name: Validar formato de secrets
      run: |
        # Verificar que JWT_SECRET tiene longitud mínima
        if [ ${#JWT_SECRET} -lt 32 ]; then
          echo "ERROR: JWT_SECRET debe tener al menos 32 caracteres"
          exit 1
        fi

        echo "OK: Secrets cumplen requisitos"
      env:
        JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

---

### 5. Build Artifacts Innecesarios

**Problema:** CI guarda dist/ de backend que no se usa en producción

**Impacto:**

- Storage desperdiciado (7 días retention)
- Confusión sobre qué se despliega realmente

**Solución propuesta:**

```yaml
# ELIMINAR este step del job build:
- name: Guardar artefactos backend
  uses: actions/upload-artifact@v4
  with:
    name: backend-artifacts
    path: backend/dist/ # <-- NO se usa en producción
    retention-days: 7

# AGREGAR validación de runtime tsx:
- name: Validar tsx runtime
  working-directory: backend
  run: |
    # Simular inicio producción
    NODE_ENV=production timeout 10s npm start || code=$?

    if [ $code -eq 124 ]; then
      echo "OK: Backend inició con tsx"
    else
      echo "ERROR: Backend falló al iniciar"
      exit 1
    fi
```

---

### 6. Sin Health Checks de Servicios

**Problema:** Tests pueden ejecutarse antes que PostgreSQL/Valkey estén ready

**Impacto:** Flaky tests, false negatives

**Solución propuesta:**

```yaml
# Agregar health checks explícitos antes de tests:
- name: Verificar servicios ready
  run: |
    # PostgreSQL
    timeout 30 bash -c 'until pg_isready -h localhost -p 5432; do sleep 2; done'

    # Valkey
    timeout 30 bash -c 'until redis-cli -h localhost -p 6379 PING; do sleep 2; done'

    echo "OK: Servicios ready"
```

---

### 7. Sin Caché de Playwright Browsers

**Problema:** Playwright descarga Chromium en cada run (~300MB)

**Impacto:** CI más lento, mayor uso de bandwidth

**Solución propuesta:**

```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: ${{ runner.os }}-playwright-${{ hashFiles('backend/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-playwright-

- name: Instalar Playwright browsers
  working-directory: backend
  run: npx playwright install --with-deps chromium
```

---

## Priorización de Mejoras

### Prioridad ALTA (implementar Día 4)

1. **Test E2E en CI** - Detectar regresiones antes de staging
2. **Validación tsx runtime** - CI debe reflejar producción real

### Prioridad MEDIA (implementar Día 5)

3. **Validación variables entorno** - Prevenir Issue #3
4. **Health checks explícitos** - Reducir flaky tests
5. **Caché Playwright** - Optimizar performance CI

### Prioridad BAJA (implementar post-Sprint 1)

6. **Eliminar build artifacts backend** - Cleanup, no crítico

### Descartado

7. **Disk space check en CI** - Runners GitHub tienen suficiente espacio, no aplica a servidor producción

---

## Métricas de Éxito

**Antes de mejoras:**

- Duración CI: ~8min
- Flaky tests: No medido
- False positives: 1 (build pasa, producción falla)
- Coverage: 60% backend, 21% PHP

**Después de mejoras (objetivo):**

- Duración CI: ~12min (E2E agrega 4min)
- Flaky tests: <5%
- False positives: 0 (CI == producción)
- Coverage: 70% backend, 60% PHP, 100% E2E flujos críticos

---

## Plan de Implementación

### Día 4 - Fase 1 (3h)

1. Agregar job test-e2e con Playwright
2. Modificar job build para validar tsx runtime
3. Agregar health checks explícitos

### Día 4 - Fase 2 (1h)

4. Caché Playwright browsers
5. Validación con push a branch test/ci-improvements

### Día 5 (1h)

6. Agregar validación variables entorno
7. Eliminar artifacts backend innecesarios

### Validación

- Push a branch test/ci-improvements
- Verificar que todos los jobs pasan
- Merge a main si exitoso

---

## Notas Adicionales

**Lecciones aprendidas:**

- CI debe reflejar producción exactamente (tsx, no tsc)
- Disk space crítico en ambientes limitados
- Health checks previenen flaky tests
- E2E tests detectan integraciones rotas

**Riesgos aceptados:**

- E2E en CI agrega 4min duración (trade-off aceptable)
- Disk check agrega 30s overhead (necesario)

**Referencias:**

- Issue Día 3: TypeScript ESM → Bitácora líneas 97-230
- Issue Día 3: Disk space → Bitácora líneas 503-543
- Issue Día 3: PostgreSQL credentials → Bitácora líneas 545-591
