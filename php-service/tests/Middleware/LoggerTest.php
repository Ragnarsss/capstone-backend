<?php

namespace JwtBridge\Tests\Middleware;

use JwtBridge\Logger;
use PHPUnit\Framework\TestCase;

class LoggerTest extends TestCase
{
    private $config;
    private $logger;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->config = [
            'logging' => [
                'enabled' => true,
                'level' => 'info'
            ]
        ];
        
        $this->logger = new Logger($this->config);
    }

    public function testLoggerCanBeInstantiated()
    {
        $this->assertInstanceOf(Logger::class, $this->logger);
    }

    public function testLoggerRespectsEnabledFlag()
    {
        $configDisabled = [
            'logging' => [
                'enabled' => false,
                'level' => 'info'
            ]
        ];
        
        $logger = new Logger($configDisabled);
        
        // Logger deshabilitado no debería hacer nada (no error)
        $this->expectNotToPerformAssertions();
        $logger->info('Test message');
    }

    public function testLoggerHasAllLevelMethods()
    {
        $this->assertTrue(method_exists($this->logger, 'debug'));
        $this->assertTrue(method_exists($this->logger, 'info'));
        $this->assertTrue(method_exists($this->logger, 'warning'));
        $this->assertTrue(method_exists($this->logger, 'error'));
    }

    public function testLoggerAcceptsContext()
    {
        // No debe lanzar excepciones
        $this->expectNotToPerformAssertions();
        
        $this->logger->info('Test with context', [
            'user' => 'test@ucn.cl',
            'ip' => '127.0.0.1'
        ]);
    }
}
