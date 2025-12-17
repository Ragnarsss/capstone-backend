# Constitución del Proyecto

## Sistema de Asistencia con Autenticación Criptográfica

**Versión:** 1.2
**Estado:** Ratificado – Estricto
**Carácter:** Normativo, vinculante y no interpretativo

---

## 0. Autoridad del documento

Este documento es vinculante. Define qué está permitido y qué está prohibido. En caso de conflicto con otra documentación, prevalece éste.

---

## 1. Identidad del proyecto

### 1.1 Nombre

Sistema de Asistencia con Autenticación Criptográfica.

### 1.2 Propiedad

El proyecto pertenece a **CMCFL**.

### 1.3 Misión

Eliminar el fraude en la validación de asistencia universitaria mediante verificación criptográfica de presencia física.

### 1.4 Valores inmutables

1. **Seguridad primero**: no debilitar el modelo criptográfico.
2. **Integración subordinada**: módulo dentro de host PHP preexistente.
3. **Simplicidad explícita**: claridad sobre ingenio.
4. **Modularidad estricta**: límites y dependencias claros.

---

## 2. Decisiones arquitectónicas obligatorias

### 2.1 Tipo de arquitectura

* Monolito modular (único modelo permitido).
* Microservicios están prohibidos.

### 2.2 Segmentación vertical

Cada módulo contiene: dominio, aplicación, infraestructura, presentación. Prohibidas capas técnicas transversales compartidas.

### 2.3 Separación de responsabilidades

* PHP: autenticación, usuarios, cursos, proxy HTTP.
* Node: lógica criptográfica y validación.
* PostgreSQL: datos persistentes.
* Valkey: estado efímero (TTL).

Sin cruces funcionales.

### 2.4 Orden de inicialización

Obligatorio este orden:

1. Infraestructura
2. Middlewares
3. Inyección de dependencias
4. Módulos backend
5. Plugin frontend

Alterarlo es una violación arquitectónica.

---

## 3. Decisiones tecnológicas cerradas

### 3.1 Tecnologías permitidas

* Host: PHP 7.4 + Apache 2.4
* Frontend: TypeScript + Vite
* Backend: Node.js 20 LTS + Fastify
* Base datos: PostgreSQL
* Cache: Valkey
* Contenedores: Podman

No se permiten otras tecnologías.

### 3.2 Restricciones técnicas

1. Host PHP: no modificable.
2. Host: sin npm.
3. Dependencias: únicamente en contenedores.
4. Contenedor: `podman compose` exclusivamente.
5. TypeScript: modo estricto obligatorio.

---

## 4. Contenedores y aislamiento

Cuatro contenedores: PHP, Node, PostgreSQL, Valkey.

Reglas:

* Solo PHP al exterior.
* BD nunca expuestas.
* Servicios internos en red privada.
* Desarrollo y producción aislados y reproducibles.

---

## 5. Principios de datos

1. Existen dos dominios de datos: enrolamiento y asistencia.
2. Cada dominio tiene su propio esquema.
3. Los esquemas no comparten tablas.
4. El estado efímero vive exclusivamente en Valkey.
5. Las migraciones son versionadas, automáticas y obligatorias.

---

## 6. Principios de seguridad

Las siguientes reglas son obligatorias:

1. El host PHP emite fichas JWT (tokens JSON Web).
2. El módulo Node solo valida fichas JWT (tokens JSON Web), nunca las emite.
3. Todo endpoint protegido valida autenticación.
4. Se aplica defensa en profundidad.
5. Los contenedores no se ejecutan con permisos de administrador (usuario root).
6. Los secretos:

   * se inyectan por variables de entorno
   * nunca se versionan
   * nunca se documentan con valores reales

---

## 7. Reglas estrictas de desarrollo (daRulez integrado)

### 7.1 Código y arquitectura

1. Mantener arquitectura modular explícita.
2. Priorizar segmentación vertical sobre capas genéricas.
3. No introducir dependencias implícitas.
4. No mezclar responsabilidades.
5. Migrar funcionalidad significa trasladar, no integrar.
6. El código debe ser desacoplado, cohesivo e idempotente cuando aplique.

### 7.2 Estilo de implementación

1. Respetar flujos existentes antes de cambiarlos.
2. Mantener patrones ya establecidos.
3. Evitar soluciones ad-hoc.
4. Preferir implementaciones simples y previsibles.

### 7.3 Comunicación técnica

1. Los emojis y emoticones están prohibidos.
2. El lenguaje debe ser técnico, explícito y preciso.
3. No se permiten adornos gráficos ni símbolos decorativos.

### 7.4 Comentarios

1. Solo en español.
2. Concisos y pertinentes.
3. Tono neutral, humilde.
4. Sin condescendencia ni verbosidad.
5. Sin documentar lo evidente.
6. Sin firma, referencia o rastro de IA (explícito o implícito).

---

## 8. Flujo de trabajo

1. Verificar estado del repositorio antes de trabajar.
2. Rama por cada tarea.
3. Commits atómicos.
4. Mensajes descriptivos y consistentes.
5. Probar manualmente antes de automatizar.
6. Reconstruir contenedores si cambian dependencias.

---

## 9. Documentación

* Este documento: principios.
* Especificaciones: en `documents/`.
* README: operativo.
* Nada puede contradecir esta constitución.

---

## 10. Enmiendas

* Principios arquitectónicos y de seguridad: inmutables.
* Cambios: requieren justificación explícita y análisis de impacto.

---

## Ratificación

Este documento es vinculante para todo el proyecto.

**Ratificado:** 2025-11-24
