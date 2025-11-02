// Sección 2.4.4 - Validación por Umbral Estadístico
// AttendanceValidator class

<?php

class AttendanceValidator {
    private const THRESHOLDS = [
        'CONFIRMED' => 0.85,      // 85% certeza → Asistencia confirmada
        'LIKELY' => 0.70,          // 70% certeza → Probablemente presente
        'UNCERTAIN' => 0.50,       // 50% certeza → Incierto
        'UNLIKELY' => 0.30,        // 30% certeza → Probablemente ausente
        'REJECTED' => 0.10         // <10% certeza → Rechazado
    ];

    private const MAX_SCAN_ATTEMPTS = 10; // Máximo de escaneos esperados por usuario
    private const IDEAL_TIME_WINDOW = 30; // Ventana ideal en segundos

    public function calculateAttendanceCertainty(array $events): float {
        $certainty = 0.0;
        $weights = [];

        // Factor 1: Número de escaneos (más escaneos = mayor certeza)
        $scanCount = count($events);
        $scanFactor = min($scanCount / self::MAX_SCAN_ATTEMPTS, 1.0);
        $weights['scan_count'] = $scanFactor * 0.25; // 25% del peso

        // Factor 2: Distribución temporal (escaneos distribuidos = mayor certeza)
        $temporalDistribution = $this->calculateTemporalDistribution($events);
        $weights['temporal'] = $temporalDistribution * 0.20; // 20% del peso

        // Factor 3: Latencia promedio (menor latencia = mayor certeza)
        $avgLatency = $this->calculateAverageLatency($events);
        $latencyFactor = $this->normalizeLatency($avgLatency);
        $weights['latency'] = $latencyFactor * 0.15; // 15% del peso

        // Factor 4: Validación de TOTPs (tokens válidos = mayor certeza)
        $totpsValidationRate = $this->calculateTOTPsValidationRate($events);
        $weights['totps'] = $totpsValidationRate * 0.30; // 30% del peso

        // Factor 5: Consistencia de deviceId (mismo dispositivo = mayor certeza)
        $deviceConsistency = $this->calculateDeviceConsistency($events);
        $weights['device'] = $deviceConsistency * 0.10; // 10% del peso

        // Certeza total
        $certainty = array_sum($weights);

        return min($certainty, 1.0);
    }

    private function calculateTemporalDistribution(array $events): float {
        if (count($events) < 2) return 0.5;

        $timestamps = array_column($events, 'timestamp');
        sort($timestamps);

        $intervals = [];
        for ($i = 1; $i < count($timestamps); $i++) {
            $intervals[] = $timestamps[$i] - $timestamps[$i - 1];
        }

        // Calcular desviación estándar de intervalos
        $mean = array_sum($intervals) / count($intervals);
        $variance = 0;
        foreach ($intervals as $interval) {
            $variance += pow($interval - $mean, 2);
        }
        $stdDev = sqrt($variance / count($intervals));

        // Distribución uniforme → stdDev bajo → mayor certeza
        // Normalizar: stdDev ideal ~1-2 segundos
        $score = 1.0 - min($stdDev / 5.0, 1.0);

        return $score;
    }

    private function calculateAverageLatency(array $events): float {
        $latencies = [];
        foreach ($events as $event) {
            // Latencia = tiempo entre QR mostrado y recepción en servidor
            $latency = $event['serverReceiveTime'] - $event['qrDisplayTime'];
            $latencies[] = $latency;
        }

        return array_sum($latencies) / count($latencies);
    }

    private function normalizeLatency(float $avgLatencyMs): float {
        // Latencia ideal: 100-500ms
        // Latencia aceptable: hasta 2000ms
        // Latencia sospechosa: >5000ms

        if ($avgLatencyMs < 500) {
            return 1.0; // Excelente
        } elseif ($avgLatencyMs < 2000) {
            return 0.8; // Bueno
        } elseif ($avgLatencyMs < 5000) {
            return 0.5; // Aceptable
        } else {
            return 0.2; // Sospechoso (puede ser replay)
        }
    }

    private function calculateTOTPsValidationRate(array $events): float {
        $validCount = 0;
        foreach ($events as $event) {
            if ($event['totpsValid'] === true) {
                $validCount++;
            }
        }

        return $validCount / count($events);
    }

    private function calculateDeviceConsistency(array $events): float {
        $devices = array_unique(array_column($events, 'credentialId'));

        // Un solo dispositivo = consistencia perfecta
        if (count($devices) === 1) {
            return 1.0;
        }

        // Múltiples dispositivos = sospechoso
        return 1.0 / count($devices);
    }

    public function determineAttendanceStatus(float $certainty): string {
        if ($certainty >= self::THRESHOLDS['CONFIRMED']) {
            return 'CONFIRMED';
        } elseif ($certainty >= self::THRESHOLDS['LIKELY']) {
            return 'LIKELY';
        } elseif ($certainty >= self::THRESHOLDS['UNCERTAIN']) {
            return 'UNCERTAIN';
        } elseif ($certainty >= self::THRESHOLDS['UNLIKELY']) {
            return 'UNLIKELY';
        } else {
            return 'REJECTED';
        }
    }

    public function shouldMarkAttendance(float $certainty): bool {
        // Marcar asistencia solo si certeza >= 70%
        return $certainty >= self::THRESHOLDS['LIKELY'];
    }
}

// Uso
$validator = new AttendanceValidator();

$userEvents = [
    ['timestamp' => 1000, 'totpsValid' => true, 'serverReceiveTime' => 1200, 'qrDisplayTime' => 1000, 'credentialId' => 'abc123'],
    ['timestamp' => 3000, 'totpsValid' => true, 'serverReceiveTime' => 3300, 'qrDisplayTime' => 3000, 'credentialId' => 'abc123'],
    ['timestamp' => 5500, 'totpsValid' => true, 'serverReceiveTime' => 5700, 'qrDisplayTime' => 5500, 'credentialId' => 'abc123'],
    // ... más eventos
];

$certainty = $validator->calculateAttendanceCertainty($userEvents);
$status = $validator->determineAttendanceStatus($certainty);

if ($validator->shouldMarkAttendance($certainty)) {
    markAttendance($userId, $sessionId, $certainty, $status);
}
