<?php
/**
 * Integration Gateway Interface
 * 
 * Responsabilidad: Definir contrato para comunicación con Node service
 * Principio: Dependency Inversion Principle, Interface Segregation
 * 
 * Esta interface permite que el domain layer no dependa de implementaciones
 * concretas de HTTP, facilitando testing y mantenibilidad
 */

interface IntegrationGateway
{
    /**
     * Envía evento de log a Node service
     * 
     * @param string $event Tipo de evento
     * @param array $data Datos del evento
     * @return array Respuesta con success, message o error
     */
    public function logEvent(string $event, array $data): array;

    /**
     * Obtiene datos de dispositivo FIDO2 desde Node
     * 
     * @param int $userId ID de usuario
     * @return array Respuesta con success y data o error
     */
    public function getDeviceData(int $userId): array;
}
