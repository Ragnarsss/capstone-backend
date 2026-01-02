# Testing Strategy and Implementation Guide

**Version:** 2.0  
**Last Updated:** 2026-01-02  
**Scope:** Backend Node.js + PHP Service

## Overview

Comprehensive testing strategy for the attendance system, covering unit, integration, and E2E tests across Node.js backend (Fastify) and PHP service (JWT Bridge).

## Stack

| Component     | Technology                 | Purpose                  |
| ------------- | -------------------------- | ------------------------ |
| Node.js Tests | Vitest                     | Unit + Integration tests |
| PHP Tests     | PHPUnit 9.6                | Unit + Integration tests |
| Coverage      | V8 (Node), PCOV (PHP)      | Code coverage analysis   |
| E2E Tests     | Playwright                 | End-to-end flows         |
| Mocking       | vi (Vitest), PHPUnit mocks | Dependency isolation     |

## Test Execution

### Node.js Backend

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific module
npm test -- auth/__tests__
```

### PHP Service

```bash
cd php-service

# All tests
php vendor/bin/phpunit

# Coverage with PCOV
php -d pcov.enabled=1 -d pcov.directory=. vendor/bin/phpunit --coverage-html coverage/

# Specific test
php vendor/bin/phpunit tests/middleware/RateLimiterTest.php
```

## Test Structure

### Node.js Backend

```
backend/
├── src/
│   └── modules/
│       ├── auth/
│       │   ├── __tests__/
│       │   │   ├── jwt-utils.test.ts
│       │   │   ├── auth.service.test.ts
│       │   │   └── user-id.test.ts
│       │   ├── domain/
│       │   ├── application/
│       │   └── presentation/
│       ├── attendance/
│       │   ├── __tests__/
│       │   │   ├── stages.test.ts
│       │   │   └── totp-validation.test.ts
│       │   └── ...
│       └── session/
│           ├── __tests__/
│           └── ...
└── tests/
    └── middleware/
        └── jwt-auth.middleware.test.ts
```

### PHP Service

```
php-service/
├── src/
│   ├── config/
│   ├── lib/
│   └── middleware/
└── tests/
    ├── bootstrap.php
    ├── config/
    │   └── ConfigTest.php
    ├── lib/
    │   └── crypto/
    │       └── JwtTest.php
    ├── middleware/
    │   ├── CorsHandlerTest.php
    │   ├── LegacySessionValidatorTest.php
    │   ├── LoggerTest.php
    │   └── RateLimiterTest.php
    └── integration/
        └── E2ETest.php
```

## Coverage Targets

| Component          | Current | Target | Priority |
| ------------------ | ------- | ------ | -------- |
| Node.js Auth       | 95%     | 95%    | Maintain |
| Node.js Attendance | 60%     | 85%    | High     |
| Node.js Session    | 70%     | 85%    | High     |
| PHP JWT Bridge     | 56.95%  | 85%    | Critical |
| E2E Flows          | 0%      | 100%   | High     |

## Testing Patterns

### Unit Test Pattern (Node.js)

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("ComponentName", () => {
  let component: ComponentType;
  let mockDependency: MockType;

  beforeEach(() => {
    mockDependency = {
      method: vi.fn(),
    };
    component = new Component(mockDependency);
  });

  describe("methodName", () => {
    it("should handle success case", async () => {
      mockDependency.method.mockResolvedValue("result");

      const result = await component.methodName();

      expect(result).toBe("expected");
      expect(mockDependency.method).toHaveBeenCalledWith("args");
    });

    it("should handle error case", async () => {
      mockDependency.method.mockRejectedValue(new Error("failed"));

      await expect(component.methodName()).rejects.toThrow("failed");
    });
  });
});
```

### Unit Test Pattern (PHP)

```php
<?php

use PHPUnit\Framework\TestCase;
use JwtBridge\ComponentName;

class ComponentNameTest extends TestCase
{
    private $component;
    private $mockDependency;

    protected function setUp(): void
    {
        $this->mockDependency = $this->createMock(DependencyInterface::class);
        $this->component = new ComponentName($this->mockDependency);
    }

    public function testMethodNameSuccess()
    {
        $this->mockDependency
            ->method('method')
            ->willReturn('result');

        $result = $this->component->methodName();

        $this->assertEquals('expected', $result);
    }

    public function testMethodNameError()
    {
        $this->mockDependency
            ->method('method')
            ->willThrowException(new \Exception('failed'));

        $this->expectException(\Exception::class);
        $this->component->methodName();
    }
}
```

## Integration Test Patterns

### Database Integration (Node.js)

```typescript
import { PostgresPool } from "@/shared/infrastructure/database";

describe("Database Integration", () => {
  let pool: PostgresPool;

  beforeAll(async () => {
    pool = PostgresPool.getInstance();
  });

  afterEach(async () => {
    await pool.query("ROLLBACK");
  });

  it("should insert and retrieve record", async () => {
    await pool.query("BEGIN");
    await pool.query("INSERT INTO table (field) VALUES ($1)", ["value"]);

    const result = await pool.query("SELECT * FROM table WHERE field = $1", [
      "value",
    ]);

    expect(result.rows).toHaveLength(1);
  });
});
```

### Session Integration (PHP)

```php
public function testSessionValidation()
{
    // Mock global session
    $_SESSION['id'] = 123;
    $_SESSION['user'] = 'test@ucn.cl';

    $validator = new LegacySessionValidator($config);
    $result = $validator->validate();

    $this->assertTrue($result);
}
```

## Mock Factories

### Node.js Test Helpers

Location: `backend/src/shared/__tests__/test-helpers.ts`

```typescript
export function createValidContext() {
  return {
    userId: 12345,
    username: "test@ucn.cl",
    rol: "profesor",
    iat: Date.now() / 1000,
    exp: Date.now() / 1000 + 300,
  };
}

export function generateTestJWT(config: JWTConfig, payload: object): string {
  return jwt.sign(payload, config.secret, {
    expiresIn: "5m",
    issuer: config.issuer,
    audience: config.audience,
  });
}

export function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue("PONG"),
  };
}
```

### PHP Test Bootstrap

Location: `php-service/tests/bootstrap.php`

```php
<?php

define('PHPUNIT_RUNNING', true);

// Stub legacy functions
if (!function_exists('is_logged_in')) {
    function is_logged_in() {
        return isset($_SESSION['user']);
    }
}

if (!function_exists('get_usuario_actual')) {
    function get_usuario_actual() {
        return $_SESSION['user'] ?? null;
    }
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test-node:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      - run: cd backend && npm ci
      - run: cd backend && npm test
      - run: cd backend && npm run test:coverage
      - uses: codecov/codecov-action@v3

  test-php:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: shivammathur/setup-php@v2
        with:
          php-version: "7.4"
          extensions: pcov, redis, pgsql
      - run: cd php-service && composer install
      - run: cd php-service && php -d pcov.enabled=1 vendor/bin/phpunit --coverage-clover coverage.xml
      - uses: codecov/codecov-action@v3
```

## Performance Benchmarks

### Vitest vs Jest (200 tests)

| Framework | Execution Time | Coverage Generation |
| --------- | -------------- | ------------------- |
| Jest      | 8-12 seconds   | 3-5 seconds         |
| Vitest    | 1-2 seconds    | <1 second           |

**Result:** Vitest is 4-6x faster than Jest for the same test suite.

### PHPUnit with PCOV vs Xdebug

| Driver | 42 Tests Execution | Coverage Report |
| ------ | ------------------ | --------------- |
| Xdebug | 2-3 seconds        | 10-15 seconds   |
| PCOV   | 0.01 seconds       | 0.04 seconds    |

**Result:** PCOV is 100x faster than Xdebug.

## Test Metrics (Current State)

### Node.js Backend

| Module     | Tests    | Coverage | Status   |
| ---------- | -------- | -------- | -------- |
| Auth       | 58       | 95%      | Pass     |
| Attendance | 7        | 60%      | Pass     |
| Session    | 15       | 70%      | Pass     |
| Enrollment | 106      | 85%      | Pass     |
| Access     | 9        | 80%      | Pass     |
| Middleware | 11       | 90%      | Pass     |
| **Total**  | **1344** | **85%**  | **Pass** |

### PHP Service

| Component         | Tests  | Coverage   | Status   |
| ----------------- | ------ | ---------- | -------- |
| Config            | 6      | 100%       | Pass     |
| JWT               | 5      | 100%       | Pass     |
| CORS              | 5      | 95%        | Pass     |
| Session Validator | 5      | 90%        | Pass     |
| Logger            | 4      | 88%        | Pass     |
| Rate Limiter      | 12     | 97%        | Pass     |
| E2E               | 5      | N/A        | Pass     |
| **Total**         | **42** | **56.95%** | **Pass** |

## Pending Work

### High Priority

1. Increase PHP coverage from 56.95% to >85%

   - Add CorsHandler edge cases (10 tests)
   - Add LegacySessionValidator error paths (8 tests)
   - Add integration tests for full request flow (5 tests)

2. Node.js Attendance module coverage 60% → 85%

   - Add TOTP expiration tests (5 tests)
   - Add database transaction tests (8 tests)
   - Add WebSocket message validation (10 tests)

3. E2E Tests with Playwright
   - Professor flow: Open QR session (1 test)
   - Student flow: Scan and register (1 test)
   - Full flow: Professor + Student integration (1 test)

### Medium Priority

4. Performance regression tests
5. Security vulnerability scanning
6. Load testing for WebSocket connections

## References

- Vitest Documentation: https://vitest.dev
- PHPUnit Documentation: https://phpunit.de
- Playwright Documentation: https://playwright.dev
- PCOV Extension: https://github.com/krakjoe/pcov

## Appendix: Test Commands Reference

### Quick Commands

```bash
# Node.js
npm test                           # All tests
npm test -- --ui                   # Vitest UI
npm test -- --reporter=verbose     # Detailed output

# PHP
vendor/bin/phpunit --testdox       # Human-readable output
vendor/bin/phpunit --filter=RateLimiter  # Specific class
vendor/bin/phpunit --stop-on-failure     # Stop on first error

# Coverage
npm run test:coverage && open coverage/index.html  # Node.js
phpunit --coverage-html cov && open cov/index.html  # PHP
```

---

**Document Status:** Active  
**Maintained By:** Backend Team  
**Review Frequency:** Weekly during development
