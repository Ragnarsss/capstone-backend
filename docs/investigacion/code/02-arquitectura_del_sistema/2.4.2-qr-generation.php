// Sección 2.4.2 - Arquitectura de Stack Tecnológico
// Biblioteca recomendada para QR en PHP

<?php
// composer require bacon/bacon-qr-code

use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

$renderer = new ImageRenderer(
    new RendererStyle(400),
    new SvgImageBackEnd()
);
$writer = new Writer($renderer);

// Acceso a BitMatrix
$qrCode = \BaconQrCode\Encoder\Encoder::encode(
    $payload,
    \BaconQrCode\Common\ErrorCorrectionLevel::H(),
    null
);

$matrix = $qrCode->getMatrix(); // BitMatrix
$size = $matrix->getWidth();

// Extraer módulo individual
for ($y = 0; $y < $size; $y++) {
    for ($x = 0; $x < $size; $x++) {
        $bit = $matrix->get($x, $y); // 0 o 1
    }
}
