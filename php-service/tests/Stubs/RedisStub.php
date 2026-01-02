<?php

/**
 * Redis stub for testing when the extension is not available
 */
class Redis
{
    public function connect($host, $port = 6379, $timeout = 0) {}
    public function incr($key) {}
    public function expire($key, $ttl) {}
    public function ttl($key) {}
    public function get($key) {}
    public function close() {}
}
