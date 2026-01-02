<?php

namespace JwtBridge\Tests\Middleware;

use JwtBridge\LegacySessionValidator;
use PHPUnit\Framework\TestCase;

class LegacySessionValidatorTest extends TestCase
{
    private $config;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->config = [
            'legacy' => [
                'session_cookie_name' => 'PHPSESSID',
                'session_path' => '/tmp/sessions',
                'db_host' => 'localhost',
                'db_name' => 'test_db',
                'db_user' => 'test_user',
                'db_pass' => 'test_pass'
            ],
            'security' => [
                'validate_legacy_session' => false,
                'allowed_roles' => ['profesor', 'admin'],
                'require_role_validation' => false
            ]
        ];
    }

    public function testValidatorCanBeInstantiated()
    {
        $validator = new LegacySessionValidator($this->config);
        $this->assertInstanceOf(LegacySessionValidator::class, $validator);
    }

    public function testValidatorHasValidateMethod()
    {
        $validator = new LegacySessionValidator($this->config);
        $this->assertTrue(method_exists($validator, 'validate'));
    }

    public function testValidatorHasValidateRoleMethod()
    {
        $validator = new LegacySessionValidator($this->config);
        $this->assertTrue(method_exists($validator, 'validateRole'));
    }

    public function testValidateRoleReturnsTrueWhenValidationDisabled()
    {
        $validator = new LegacySessionValidator($this->config);
        
        $user = [
            'username' => 'test@ucn.cl',
            'rol' => 'estudiante' // No está en allowed_roles
        ];
        
        // Con require_role_validation = false, debería permitir cualquier rol
        $this->assertTrue($validator->validateRole($user));
    }

    public function testConfigLoadsCorrectly()
    {
        $validator = new LegacySessionValidator($this->config);
        
        // Verificar que se instancia sin errores
        $this->assertInstanceOf(LegacySessionValidator::class, $validator);
    }

    public function testValidateWithValidationDisabled()
    {
        $_SESSION['user'] = 'test@ucn.cl';
        
        $validator = new LegacySessionValidator($this->config);
        $result = $validator->validate();
        
        // Con validate_legacy_session = false, debería retornar true siempre que haya $_SESSION['user']
        $this->assertTrue($result);
        
        unset($_SESSION['user']);
    }

    public function testValidateRoleWithMultipleAllowedRoles()
    {
        $config = $this->config;
        $config['security']['require_role_validation'] = false;
        $config['security']['allowed_roles'] = ['profesor', 'admin', 'coordinador'];
        
        $validator = new LegacySessionValidator($config);
        
        // Con require_role_validation = false, cualquier rol es válido
        $this->assertTrue($validator->validateRole(['rol' => 'estudiante']));
        $this->assertTrue($validator->validateRole(['rol' => 'profesor']));
        $this->assertTrue($validator->validateRole(['rol' => 'admin']));
    }

    public function testValidatorWithDifferentSessionCookieName()
    {
        $config = $this->config;
        $config['legacy']['session_cookie_name'] = 'CUSTOM_SESSID';
        
        $validator = new LegacySessionValidator($config);
        
        $this->assertInstanceOf(LegacySessionValidator::class, $validator);
    }

    public function testValidatorWithCustomSessionPath()
    {
        $config = $this->config;
        $config['legacy']['session_path'] = '/custom/path/sessions';
        
        $validator = new LegacySessionValidator($config);
        
        $this->assertInstanceOf(LegacySessionValidator::class, $validator);
    }

    protected function tearDown(): void
    {
        if (isset($_SESSION)) {
            $_SESSION = [];
        }
        parent::tearDown();
    }
}
