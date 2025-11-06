Este documento define los acrónimos, tecnologías y conceptos clave utilizados en el `Plan.md` del Sistema de Asistencia Criptográfica.

---

## A. Conceptos de Arquitectura y Seguridad

- **AES-256-GCM**: **Advanced Encryption Standard (256 bits, Galois/Counter Mode)**. Es un algoritmo de cifrado simétrico que ofrece confidencialidad, integridad y autenticidad. Se usa para cifrar los *payloads* de los QR, asegurando que no puedan ser leídos ni manipulados por terceros.
- **Device Binding**: **Vinculación de Dispositivo**. Proceso de asociar criptográficamente una cuenta de usuario a un dispositivo físico específico. En este proyecto, se logra mediante FIDO2/WebAuthn, creando una credencial que solo puede ser usada desde ese dispositivo.
- **ECDH**: **Elliptic-Curve Diffie-Hellman**. Es un protocolo de acuerdo de claves que permite a dos partes, cada una con un par de claves pública-privada de curva elíptica, establecer un secreto compartido a través de un canal inseguro. Es la base para el intercambio confidencial de claves en el sistema.
- **FIDO2/WebAuthn**: **Fast IDentity Online v2 / Web Authentication API**. Es un estándar abierto que permite la autenticación sin contraseña (o *passwordless*) utilizando criptografía de clave pública. Permite a los usuarios iniciar sesión con biométricos (huella, rostro) o llaves de seguridad (YubiKey), vinculando la autenticación a un dispositivo físico.
- **HAWAII**: Nombre del sistema PHP existente con el que se integra el nuevo servicio de asistencia. Actúa como el orquestador principal y punto de entrada para los usuarios.
- **HKDF**: **HMAC-based Key Derivation Function**. Es un algoritmo que transforma un material de clave inicial (generalmente de baja entropía) en una o más claves criptográficas seguras. Se usa para derivar `handshake_secret` y `session_key`.
- **JWT**: **JSON Web Token**. Un estándar compacto y autónomo para transmitir información de forma segura entre partes como un objeto JSON. En este proyecto, el sistema PHP (HAWAII) emite un JWT para autorizar al cliente a comunicarse con el servicio Node.js.
- **Monolito Modular**: Un estilo de arquitectura de software donde la aplicación se construye como una única unidad (monolito), pero internamente está dividida en módulos con límites claros y alta cohesión. Ofrece un buen equilibrio entre simplicidad de despliegue y organización del código.
- **Perfect Forward Secrecy (PFS)**: **Secreto Perfecto Hacia Adelante**. Una propiedad de los protocolos de comunicación seguros que garantiza que si las claves a largo plazo de una sesión son comprometidas, las claves de sesiones pasadas no pueden ser descifradas. ECDH es fundamental para lograr PFS.
- **Podman**: Una herramienta de gestión de contenedores de código abierto, alternativa a Docker. Se utiliza para ejecutar el servicio Node.js, la base de datos y la caché en entornos aislados.
- **Reverse Proxy**: **Proxy Inverso**. Un servidor que se sitúa delante de uno o más servidores web, recibiendo las peticiones de los clientes y reenviándolas al servidor apropiado. En este proyecto, Apache actúa como proxy inverso para dirigir el tráfico a PHP o al servicio Node.js según la URL.
- **RT (Response Time)**: **Tiempo de Respuesta**. Métrica que mide el tiempo transcurrido desde que se muestra un QR hasta que el servidor recibe la respuesta del alumno. El análisis estadístico de los RT es clave para detectar anomalías y posible fraude.
- **Valkey**: Un fork de código abierto del popular almacén de datos en memoria Redis. Se utiliza como caché para almacenar datos volátiles de alta velocidad, como las `session_key` y las colas de QR pendientes de proyección.
- **WebSocket**: Un protocolo de comunicación que permite una interacción bidireccional y en tiempo real entre un cliente (navegador) y un servidor. Es la tecnología utilizada para el módulo de proyección, donde el servidor envía los QR al proyector del profesor.

## B. Variables y Flujos Específicos del Proyecto

- **`challenge`**: En WebAuthn, es un dato aleatorio generado por el servidor y enviado al cliente. El cliente debe firmar este `challenge` con su clave privada para demostrar la posesión de la credencial. Previene ataques de repetición.
- **`handshake_secret`**: Un secreto criptográfico derivado durante el proceso de enrolamiento mediante HKDF. Es una clave maestra a largo plazo asociada al dispositivo del usuario.
- **`session_key`**: **Clave de Sesión**. Una clave simétrica temporal, derivada del `handshake_secret` y el intercambio ECDH al inicio de cada sesión de login. Se usa para cifrar y descifrar la comunicación durante esa sesión específica (ej. los QR). No se transmite por la red.
- **QR Rotatorios**: **QR Codes Rotatorios**. Los códigos QR que se muestran en la pantalla del profesor cambian periódicamente (cada pocos segundos). Cada QR es único para un alumno y una ronda de validación, lo que dificulta que se compartan.
- **TOTP**: **Time-based One-Time Password**. Un algoritmo que genera un código numérico de un solo uso que cambia cada cierto tiempo (ej. 30 segundos).
- **TOTPu**: **TOTP del Usuario**. Un código TOTP generado en el dispositivo del alumno y enviado al servidor como parte de la validación de asistencia. Demuestra que el alumno tiene acceso a la `session_key`.
- **TOTPs**: **TOTP del Servidor**. Un código TOTP generado en el servidor. El servidor lo utiliza para verificar la validez del `TOTPu` recibido, asegurando que ambos estén sincronizados en tiempo.
- **Testing Unitario**: Una metodología de pruebas de software que se enfoca en verificar el correcto funcionamiento de las unidades más pequeñas de código (funciones, métodos) de forma aislada.
- **E2E Testing**: **End-to-End Testing**. Un tipo de prueba que simula el flujo completo de un usuario a través de la aplicación para verificar que todos los componentes integrados funcionan juntos como se espera.
