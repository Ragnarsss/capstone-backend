<?php

namespace JwtBridge;

/**
 * Utilidad: Logger centralizado
 */

class Logger
{
    private $config;

    public function __construct($config)
    {
        $this->config = $config;
    }

    public function log($level, $message, $context = [])
    {
        if (!$this->config['logging']['enabled']) {
            return;
        }

        $levels = ['debug' => 0, 'info' => 1, 'warning' => 2, 'error' => 3];
        $currentLevel = $levels[$this->config['logging']['level']] ?? 1;
        $messageLevel = $levels[$level] ?? 1;

        if ($messageLevel < $currentLevel) {
            return; // No loggear si el nivel es menor al configurado
        }

        $timestamp = date('Y-m-d H:i:s');
        $contextStr = empty($context) ? '' : ' ' . json_encode($context);
        $logMessage = "[{$timestamp}] [{$level}] {$message}{$contextStr}";

        error_log($logMessage);
    }

    public function debug($message, $context = [])
    {
        $this->log('debug', $message, $context);
    }

    public function info($message, $context = [])
    {
        $this->log('info', $message, $context);
    }

    public function warning($message, $context = [])
    {
        $this->log('warning', $message, $context);
    }

    public function error($message, $context = [])
    {
        $this->log('error', $message, $context);
    }
}
