// Sección 2.4.5 - Timestamps del Servidor para Anti-Replay
// QRProjectionManager class

<?php

class QRProjectionManager {
    private $projectionLog = []; // En producción: Redis o base de datos

    public function queueQRForProjection(string $userId, string $qrData, string $totps): void {
        $qrId = uniqid('qr_', true);

        $this->projectionLog[$qrId] = [
            'userId' => $userId,
            'totps' => $totps,
            'qrData' => $qrData,
            'queuedAt' => microtime(true),
            'displayedAt' => null,
            'expiresAt' => time() + 60 // Expira en 60 segundos
        ];

        // Añadir a cola de proyección
        $this->sendToProjectionQueue($qrId, $qrData);
    }

    public function markQRAsDisplayed(string $qrId): void {
        if (isset($this->projectionLog[$qrId])) {
            $this->projectionLog[$qrId]['displayedAt'] = microtime(true);
        }
    }

    public function validateScanTiming(string $totps, float $clientTimestamp): array {
        // Buscar QR por TOTPs
        $qrLog = null;
        foreach ($this->projectionLog as $log) {
            if ($log['totps'] === $totps) {
                $qrLog = $log;
                break;
            }
        }

        if (!$qrLog) {
            return ['valid' => false, 'reason' => 'QR not found or expired'];
        }

        $displayedAt = $qrLog['displayedAt'];
        if (!$displayedAt) {
            return ['valid' => false, 'reason' => 'QR not yet displayed'];
        }

        $serverReceiveTime = microtime(true);
        $latency = ($serverReceiveTime - $displayedAt) * 1000; // ms

        // Validar ventana temporal
        if ($latency < 100) {
            // Demasiado rápido, sospechoso
            return ['valid' => false, 'reason' => 'Suspiciously fast', 'latency' => $latency];
        }

        if ($latency > 10000) {
            // Más de 10 segundos, probablemente replay
            return ['valid' => false, 'reason' => 'Too slow (replay?)', 'latency' => $latency];
        }

        return [
            'valid' => true,
            'latency' => $latency,
            'displayedAt' => $displayedAt,
            'receivedAt' => $serverReceiveTime
        ];
    }
}
