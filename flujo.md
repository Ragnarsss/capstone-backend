# Flujo de Arquitectura: Sistema de Asistencia

## 1. Arquitectura General - PHP Legacy + Servicio Asistencia

```mermaid
flowchart TB
    subgraph Produccion["Sistema Produccion (NO modificable)"]
        direction TB
        AUTH_LEGACY["Sistema Autenticacion<br/>Legacy PHP"]
        ROLE_SYSTEM["Sistema de Roles<br/>(profesor/alumno)"]
        
        subgraph UI_Prof["UI Profesor"]
            BTN_HOST["Boton: Proyectar QR"]
        end
        
        subgraph UI_Alum["UI Alumno/Invitado"]
            BTN_GUEST["Boton: Escanear QR"]
        end
    end

    subgraph Asistencia["Servicio de Asistencia"]
        direction TB
        
        subgraph Apache["Apache (Proxy)"]
            PROXY_HOST["/asistencia/host/ -> Node"]
            PROXY_READER["/asistencia/reader/ -> Node"]
            PROXY_WS["/asistencia/ws -> WebSocket"]
        end
        
        subgraph Node["Node.js Service"]
            direction TB
            WS_SERVER["WebSocket Server<br/>QR dinamicos"]
            
            subgraph FE["Frontend Features"]
                QR_HOST["qr-host/<br/>Proyector QR"]
                QR_READER["qr-reader/<br/>Lector Camara"]
            end
            
            QR_GEN["Generador QR<br/>~3 QR/estudiante<br/>cifrados"]
        end
    end

    subgraph Modals["Modales/iframes Distintos"]
        MODAL_A["Modal Proyeccion<br/>(pantalla profesor)"]
        MODAL_B["Modal Lector<br/>(dispositivo alumno)"]
    end

    AUTH_LEGACY --> ROLE_SYSTEM
    ROLE_SYSTEM -->|"rol=profesor"| BTN_HOST
    ROLE_SYSTEM -->|"rol=alumno"| BTN_GUEST
    
    BTN_HOST -->|"Click"| MODAL_A
    MODAL_A -->|"iframe src"| PROXY_HOST
    PROXY_HOST --> QR_HOST
    QR_HOST <-->|"WSS<br/>QR stream"| WS_SERVER
    WS_SERVER <--> QR_GEN
    
    BTN_GUEST -->|"Click"| MODAL_B
    MODAL_B -->|"iframe src"| PROXY_READER
    PROXY_READER --> QR_READER
```

---

## 2. Flujo de Datos - WebSocket para QR Dinamicos

```mermaid
sequenceDiagram
    participant Prof as Profesor<br/>(Proyector)
    participant WS as WebSocket<br/>Server
    participant QRGen as QR Generator
    participant DB as Base Datos
    participant Alum as Alumno<br/>(Lector)

    Note over Prof,Alum: El profesor inicia sesion de asistencia
    
    Prof->>WS: Conectar WSS
    WS->>Prof: Connected
    
    loop Cada N segundos (configurable)
        WS->>QRGen: Generar batch QR
        QRGen->>DB: Obtener alumnos inscritos
        DB-->>QRGen: Lista alumnos
        
        Note over QRGen: Genera ~3 QR cifrados<br/>por alumno inscrito
        
        QRGen-->>WS: QR codes (encrypted)
        WS->>Prof: qr-update event
        Prof->>Prof: Mostrar QR en pantalla
    end

    Note over Alum: Alumno abre camara cuando ve QR
    
    Alum->>Alum: Escanear QR proyectado
    Alum->>WS: POST /attendance (QR data)
    WS->>QRGen: Validar firma + timestamp
    
    alt QR valido y no expirado
        QRGen->>DB: Registrar asistencia
        WS-->>Alum: Asistencia OK
    else QR expirado o invalido
        WS-->>Alum: QR no valido
    end
```

---

## 3. Separacion de Responsabilidades

```mermaid
flowchart LR
    subgraph Legacy["Sistema Legacy PHP<br/>(Produccion - NO tocar)"]
        direction TB
        L1["Autenticacion"]
        L2["Gestion de Roles"]
        L3["UI Principal"]
        L4["Botones por Rol"]
        L5["Abre Modal/iframe"]
    end

    subgraph Servicio["Servicio Asistencia<br/>(Independiente)"]
        direction TB
        S1["Recibe JWT<br/>(validacion redundante)"]
        S2["Proyector QR<br/>/asistencia/host/"]
        S3["Lector QR<br/>/asistencia/reader/"]
        S4["WebSocket<br/>Stream QR"]
        S5["Criptografia<br/>QR firmados"]
        S6["Registro<br/>Asistencia"]
    end

    Legacy -->|"iframe + JWT"| Servicio
```

---

## 4. Punto de Acceso Unificado

```mermaid
flowchart TB
    subgraph PHP["PHP (unico punto de entrada)"]
        JWT_ENDPOINT["/asistencia-node-integration/api/token"]
        
        subgraph Modales["Modales segun rol"]
            MODAL_HOST["Modal Host<br/>iframe: /asistencia/host/"]
            MODAL_READER["Modal Reader<br/>iframe: /asistencia/reader/"]
        end
    end

    subgraph Apache["Apache Proxy"]
        PROXY["/asistencia/* -> node:3000"]
    end

    subgraph Node["Node.js (interno)"]
        HOST["/asistencia/host/<br/>qr-host"]
        READER["/asistencia/reader/<br/>qr-reader"]
        WS["/asistencia/ws"]
    end

    JWT_ENDPOINT -->|"JWT"| MODAL_HOST & MODAL_READER
    MODAL_HOST -->|"iframe.src"| PROXY --> HOST
    MODAL_READER -->|"iframe.src"| PROXY --> READER
    HOST <-->|"WebSocket"| WS
```

---

## 5. Flujo de Autenticacion JWT + postMessage

```mermaid
sequenceDiagram
    participant User as Usuario
    participant PHP as PHP (index.php)
    participant API as /api/token
    participant Modal as Modal + iframe
    participant Node as Node Frontend
    participant WS as WebSocket

    User->>PHP: Click boton (Host/Reader)
    PHP->>API: fetch('/asistencia-node-integration/api/token')
    API-->>PHP: { success: true, token: "eyJ..." }
    PHP->>Modal: Abrir modal, iframe.src = /asistencia/host/ o /reader/
    Modal->>Node: Cargar pagina
    Node-->>Modal: HTML + JS cargado
    PHP->>Modal: postMessage({ type: 'AUTH_TOKEN', token })
    Modal->>Node: window.addEventListener('message')
    Node->>Node: TokenStorage.save(token)
    Node->>WS: Conectar con token
    WS-->>Node: Autenticado, stream QR
```

---

## 6. Resumen de Componentes

| Componente | Responsabilidad | Ruta |
|------------|-----------------|------|
| PHP Legacy | Autenticacion, roles, UI, botones | Sistema existente |
| JWT Endpoint | Genera token para iframes | `/asistencia-node-integration/api/token` |
| Modal Host | iframe para profesor | `/asistencia/host/` |
| Modal Reader | iframe para alumno | `/asistencia/reader/` |
| qr-host | Mostrar QR dinamicos via WebSocket | Proyector |
| qr-reader | Camara + escaneo QR | Lector |
| WebSocket | Stream de QR cifrados | `/asistencia/ws` |

---

## 7. Validacion Redundante de Seguridad

El servicio de asistencia agrega validacion extra sobre el JWT recibido:

```text
Middleware Node.js:
  - Validar firma JWT
  - Verificar expiracion
  - Para /asistencia/ws: verificar rol=profesor
  - Para /asistencia/reader/: cualquier usuario autenticado
```

