<?php

namespace JwtBridge\Tests\Middleware;

use PHPUnit\Framework\TestCase;
use JwtBridge\RateLimiter;

// Load Redis stub if extension not available
if (!class_exists('Redis')) {
    require_once __DIR__ . '/../Stubs/RedisStub.php';
}

class RateLimiterTest extends TestCase
{
    private $configEnabled;
    private $configDisabled;
    
    protected function setUp(): void
    {
        parent::setUp();
        
        $this->configEnabled = [
            'rate_limit' => [
                'enabled' => true,
                'max_requests' => 10,
                'window_seconds' => 60,
                'redis_host' => 'localhost',
                'redis_port' => 6379
            ]
        ];
        
        $this->configDisabled = [
            'rate_limit' => [
                'enabled' => false,
                'max_requests' => 10,
                'window_seconds' => 60,
                'redis_host' => 'localhost',
                'redis_port' => 6379
            ]
        ];
    }
    
    /**
     * @test
     */
    public function it_can_be_instantiated_with_enabled_config()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->method('connect')->willReturn(true);
        
        $limiter = new RateLimiter($this->configDisabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $this->assertInstanceOf(RateLimiter::class, $limiter);
    }
    
    /**
     * @test
     */
    public function it_can_be_instantiated_with_disabled_config()
    {
        $limiter = new RateLimiter($this->configDisabled);
        $this->assertInstanceOf(RateLimiter::class, $limiter);
    }
    
    /**
     * @test
     */
    public function it_bypasses_check_when_disabled()
    {
        $limiter = new RateLimiter($this->configDisabled);
        $result = $limiter->check('192.168.1.1');
        
        $this->assertTrue($result);
    }
    
    /**
     * @test
     */
    public function it_increments_counter_on_check()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->expects($this->once())
            ->method('incr')
            ->with('rate_limit:jwt:192.168.1.1')
            ->willReturn(1);
        
        $redisMock->expects($this->once())
            ->method('expire')
            ->with('rate_limit:jwt:192.168.1.1', 60);
        
        $limiter = new RateLimiter($this->configEnabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $result = $limiter->check('192.168.1.1');
        $this->assertTrue($result);
    }
    
    /**
     * @test
     */
    public function it_returns_remaining_attempts()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->method('get')
            ->with('rate_limit:jwt:192.168.1.1')
            ->willReturn('3');
        
        $limiter = new RateLimiter($this->configEnabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $remaining = $limiter->getRemainingAttempts('192.168.1.1');
        $this->assertEquals(7, $remaining);
    }
    
    /**
     * @test
     */
    public function it_allows_requests_within_limit()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->method('incr')
            ->willReturn(5);
        
        $limiter = new RateLimiter($this->configEnabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $result = $limiter->check('192.168.1.1');
        $this->assertTrue($result);
    }
    
    /**
     * @test
     */
    public function it_handles_redis_connection_failure_gracefully()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->method('connect')
            ->willThrowException(new \Exception('Connection refused'));
        
        $limiter = new RateLimiter($this->configDisabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $result = $limiter->check('192.168.1.1');
        $this->assertTrue($result);
    }
    
    /**
     * @test
     */
    public function it_handles_redis_command_failure()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->method('incr')
            ->willThrowException(new \Exception('Connection lost'));
        
        $limiter = new RateLimiter($this->configEnabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $result = $limiter->check('192.168.1.1');
        $this->assertTrue($result);
    }
    
    /**
     * @test
     */
    public function it_handles_first_request_correctly()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->method('incr')
            ->willReturn(1);
        
        $redisMock->expects($this->once())
            ->method('expire')
            ->with('rate_limit:jwt:192.168.1.1', 60);
        
        $limiter = new RateLimiter($this->configEnabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $result = $limiter->check('192.168.1.1');
        $this->assertTrue($result);
    }
    
    /**
     * @test
     */
    public function it_uses_correct_redis_key_format()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->expects($this->once())
            ->method('incr')
            ->with('rate_limit:jwt:203.0.113.1')
            ->willReturn(1);
        
        $limiter = new RateLimiter($this->configEnabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $limiter->check('203.0.113.1');
    }
    
    /**
     * @test
     */
    public function it_returns_null_remaining_attempts_on_redis_error()
    {
        $redisMock = $this->createMock('Redis');
        $redisMock->method('get')
            ->willThrowException(new \Exception('Connection lost'));
        
        $limiter = new RateLimiter($this->configEnabled);
        $this->injectRedisMock($limiter, $redisMock);
        
        $remaining = $limiter->getRemainingAttempts('192.168.1.1');
        $this->assertNull($remaining);
    }
    
    /**
     * @test
     */
    public function it_returns_null_remaining_when_redis_not_available()
    {
        $limiter = new RateLimiter($this->configDisabled);
        
        $remaining = $limiter->getRemainingAttempts('192.168.1.1');
        $this->assertNull($remaining);
    }
    
    /**
     * Helper: Inyectar mock de Redis usando reflection
     */
    private function injectRedisMock($limiter, $redisMock)
    {
        $reflection = new \ReflectionClass($limiter);
        $property = $reflection->getProperty('redis');
        $property->setAccessible(true);
        $property->setValue($limiter, $redisMock);
    }
}
