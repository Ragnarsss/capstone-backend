// Sección 2.4.6 - Criterios de Finalización del Ciclo
// AttendanceSessionManager class

<?php

class AttendanceSessionManager {
    public function shouldStopProjection(string $sessionId): bool {
        $session = $this->getSession($sessionId);

        // Condición 1: Todos los usuarios registrados completaron validación
        if ($this->allUsersCompleted($session)) {
            return true;
        }

        // Condición 2: Timeout absoluto alcanzado
        $elapsed = time() - $session['startedAt'];
        $maxDuration = $this->calculateMaxDuration($session);

        if ($elapsed > $maxDuration) {
            return true;
        }

        return false;
    }

    private function allUsersCompleted(array $session): bool {
        foreach ($session['participants'] as $userId => $data) {
            if ($data['certainty'] < 0.70) { // Umbral mínimo
                return false; // Al menos uno no completó
            }
        }
        return true;
    }

    private function calculateMaxDuration(array $session): int {
        $numParticipants = count($session['participants']);
        $intervalMs = 500; // ms por QR
        $cyclesNeeded = 3; // 3 rondas de validación

        // Tiempo ideal
        $idealTime = ($numParticipants * $intervalMs / 1000) * $cyclesNeeded;

        // Agregar buffer del 50% para condiciones adversas
        $maxTime = $idealTime * 1.5;

        // Límite absoluto: no más de 2 minutos
        return min($maxTime, 120);
    }
}

// Ejemplos:
// 10 usuarios: (10 * 0.5seg * 3 rondas) * 1.5 = 22.5 seg
// 30 usuarios: (30 * 0.5seg * 3 rondas) * 1.5 = 67.5 seg
// 100 usuarios: (100 * 0.3seg * 3 rondas) * 1.5 = 135 seg → limitado a 120 seg
