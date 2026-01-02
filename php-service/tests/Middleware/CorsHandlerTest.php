<?php

namespace JwtBridge\Tests\Middleware;

use JwtBridge\CorsHandler;
use PHPUnit\Framework\TestCase;

class CorsHandlerTest extends TestCase
{
    private $config;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->config = [
            'cors' => [
                'allowed_origins' => [
                    'http://localhost:9506',
                    'https://mantochrisal.cl'
                ],
                'allow_credentials' => true
            ]
        ];
    }

    public function testCorsHandlerCanBeInstantiated()
    {
        $handler = new CorsHandler($this->config);
        $this->assertInstanceOf(CorsHandler::class, $handler);
    }

    public function testIsOriginAllowedReturnsTrueForAllowedOrigins()
    {
        $handler = new CorsHandler($this->config);
        
        $this->assertTrue($handler->isOriginAllowed('http://localhost:9506'));
        $this->assertTrue($handler->isOriginAllowed('https://mantochrisal.cl'));
    }

    public function testIsOriginAllowedReturnsFalseForDisallowedOrigins()
    {
        $handler = new CorsHandler($this->config);
        
        $this->assertFalse($handler->isOriginAllowed('http://evil.com'));
        $this->assertFalse($handler->isOriginAllowed('https://malicious.site'));
    }

    public function testEmptyAllowedOriginsPermitsAll()
    {
        $config = [
            'cors' => [
                'allowed_origins' => [],
                'allow_credentials' => false
            ]
        ];
        
        $handler = new CorsHandler($config);
        
        // Con lista vacía, debería permitir todos
        $this->assertTrue($handler->isOriginAllowed('http://any-site.com'));
        $this->assertTrue($handler->isOriginAllowed('https://random.org'));
    }

    public function testCorsHandlerHasHandleMethod()
    {
        $handler = new CorsHandler($this->config);
        $this->assertTrue(method_exists($handler, 'handle'));
    }

    public function testIsOriginAllowedWithMultipleOrigins()
    {
        $config = [
            'cors' => [
                'allowed_origins' => [
                    'http://localhost:3000',
                    'http://localhost:9506',
                    'https://mantochrisal.cl',
                    'https://losvilos.ucn.cl'
                ],
                'allow_credentials' => true
            ]
        ];
        
        $handler = new CorsHandler($config);
        
        $this->assertTrue($handler->isOriginAllowed('http://localhost:3000'));
        $this->assertTrue($handler->isOriginAllowed('https://mantochrisal.cl'));
        $this->assertTrue($handler->isOriginAllowed('https://losvilos.ucn.cl'));
        $this->assertFalse($handler->isOriginAllowed('http://attacker.com'));
    }

    public function testIsOriginAllowedCaseSensitive()
    {
        $handler = new CorsHandler($this->config);
        
        // CORS origins son case-sensitive
        $this->assertTrue($handler->isOriginAllowed('http://localhost:9506'));
        $this->assertFalse($handler->isOriginAllowed('HTTP://LOCALHOST:9506'));
    }

    public function testConfigWithCredentialsDisabled()
    {
        $config = [
            'cors' => [
                'allowed_origins' => ['http://localhost:9506'],
                'allow_credentials' => false
            ]
        ];
        
        $handler = new CorsHandler($config);
        $this->assertInstanceOf(CorsHandler::class, $handler);
    }
}
