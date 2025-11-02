import Fastify from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { config } from './config';
import { WebSocketHandler } from './features/websocket-handler';
import { ValkeyClient } from './features/valkey-client';

// Punto de entrada principal del servicio
async function main() {
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Registra el plugin de WebSocket
  await fastify.register(fastifyWebSocket);

  // Inicializa el cliente Valkey
  const valkeyClient = new ValkeyClient();

  // Registra el handler de WebSocket
  const wsHandler = new WebSocketHandler();
  await wsHandler.register(fastify);

  // Ruta de health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Pagina HTML principal que se carga en el iframe desde PHP
  fastify.get('/', async (request, reply) => {
    reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asistencia - QR Dinamico</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: rgb(255, 128, 0);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
      text-align: center;
      max-width: 500px;
      width: 100%;
    }

    h1 {
      color: #333;
      margin-bottom: 30px;
      font-size: 28px;
    }

    #status {
      font-size: 18px;
      color: #666;
      margin-bottom: 20px;
      min-height: 30px;
    }

    #countdown {
      font-size: 72px;
      font-weight: bold;
      color: #667eea;
      margin: 30px 0;
      display: none;
    }

    #qr-container {
      display: none;
      margin-top: 20px;
    }

    #qr-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .loading {
      display: inline-block;
      width: 50px;
      height: 50px;
      border: 5px solid #f3f3f3;
      border-top: 5px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error {
      color: #e74c3c;
      padding: 15px;
      background: #fadbd8;
      border-radius: 8px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Asistencia TONGOY <br> Resurrection of QR</h1>
    <div id="status">Conectando...</div>
    <div id="countdown"></div>
    <div id="qr-container">
      <img id="qr-image" alt="Codigo QR" />
    </div>
  </div>

  <script>
    // Configuracion del WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Usa la ruta configurada en Apache: /asistencia/ws
    const wsUrl = protocol + '//' + window.location.host + '/asistencia/ws';

    console.log('[WebSocket] Intentando conectar a:', wsUrl);

    let ws;
    const statusEl = document.getElementById('status');
    const countdownEl = document.getElementById('countdown');
    const qrContainer = document.getElementById('qr-container');
    const qrImage = document.getElementById('qr-image');

    function connect() {
      console.log('[WebSocket] Estableciendo conexion...');
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket conectado');
        statusEl.textContent = 'Preparando sistema...';
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Error parseando mensaje:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        statusEl.innerHTML = '<div class="error">Error de conexion. Reintentando...</div>';
      };

      ws.onclose = () => {
        console.log('WebSocket cerrado. Reintentando en 3s...');
        setTimeout(connect, 3000);
      };
    }

    function handleMessage(message) {
      switch (message.type) {
        case 'countdown':
          handleCountdown(message.payload.seconds);
          break;
        case 'qr-update':
          handleQRUpdate(message.payload);
          break;
        default:
          console.warn('Tipo de mensaje desconocido:', message.type);
      }
    }

    function handleCountdown(seconds) {
      countdownEl.style.display = 'block';
      countdownEl.textContent = seconds;
      statusEl.textContent = 'Iniciando en...';
      qrContainer.style.display = 'none';
    }

    function handleQRUpdate(payload) {
      countdownEl.style.display = 'none';
      qrContainer.style.display = 'block';
      qrImage.src = payload.qrData;
      statusEl.textContent = 'Escanea el codigo QR para registrar asistencia';
    }

    // Inicia la conexion
    connect();
  </script>
</body>
</html>
    `);
  });

  // Manejo de shutdown
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`[Server] Recibido ${signal}, cerrando...`);
      await valkeyClient.close();
      await fastify.close();
      process.exit(0);
    });
  });

  // Inicia el servidor
  try {
    await fastify.listen({
      host: config.server.host,
      port: config.server.port,
    });
    console.log(`[Server] Corriendo en http://${config.server.host}:${config.server.port}`);
  } catch (error) {
    console.error('[Server] Error al iniciar:', error);
    process.exit(1);
  }
}

main();
