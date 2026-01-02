# ⚠️ DECISIÓN ARQUITECTÓNICA PENDIENTE

**Fecha:** 2026-01-02  
**Prioridad:** URGENTE/IMPORTANTE (Cuadrante I - Eisenhower)  
**Estado:** 🔴 BLOQUEANTE

## Contexto

Tenemos implementado:
- ✅ JWT Bridge Service (PHP, puerto 9001) 
- ✅ Sistema Legacy Hawaii (PHP)
- ✅ Backend Node.js (WebSocket + lógica)
- ✅ Frontend React (estático)

## Decisión Requerida

**¿Cuál es el flujo de autenticación?**

### Opción A: Frontend → PHP Bridge
```
Usuario autenticado en Legacy Hawaii (sesión PHP)
    ↓
Frontend React llama http://servidor:9001/ (PHP Bridge)
    ↓
PHP Bridge valida sesión legacy + genera JWT
    ↓
Frontend recibe JWT
    ↓
Frontend se conecta a WebSocket Node.js con JWT
    ↓
Node.js valida JWT con secret compartido
```

**Pros:**
- ✅ Separación clara de responsabilidades
- ✅ Frontend maneja su propia autenticación
- ✅ Node.js solo valida JWTs (stateless)

**Contras:**
- ❌ Frontend debe manejar cookies de sesión PHP
- ❌ CORS entre dominios/puertos
- ❌ Exposición directa del bridge al navegador

### Opción B: Frontend → Node.js → PHP Bridge
```
Usuario autenticado en Legacy Hawaii
    ↓
Frontend React se conecta a Node.js
    ↓
Node.js llama internamente PHP Bridge (http://localhost:9001/)
    ↓
PHP Bridge valida sesión + genera JWT
    ↓
Node.js recibe JWT y lo valida
    ↓
Node.js establece WebSocket con frontend
```

**Pros:**
- ✅ PHP Bridge no expuesto al navegador
- ✅ Node.js como único punto de entrada
- ✅ Manejo centralizado de sesiones

**Contras:**
- ❌ Node.js debe manejar sesiones PHP (compartir session store?)
- ❌ Acoplamiento Node.js ↔ PHP Bridge
- ❌ Más complejo de debuggear

### Opción C: Híbrido con Proxy Nginx
```
Frontend → Nginx
    ↓
    ├─→ /api/token → PHP Bridge (9001)
    └─→ /ws → Node.js WebSocket
```

**Pros:**
- ✅ Un solo origen (sin CORS)
- ✅ PHP Bridge y Node.js independientes
- ✅ Nginx maneja SSL/TLS

**Contras:**
- ❌ Requiere configuración Nginx adicional
- ❌ Complejidad de deployment

## Preguntas Críticas

1. **¿El sistema legacy comparte sesiones entre servidores?**
   - Si sí: ¿Dónde están? (Redis, DB, filesystem?)
   
2. **¿El frontend ya tiene la cookie de sesión PHP?**
   - Si sí: ¿Puede enviarla al PHP Bridge?
   
3. **¿Node.js necesita validar permisos o solo conectividad?**
   - Si valida permisos: ¿Necesita info del usuario o solo el JWT?

4. **¿Dónde está el JWT_SECRET compartido?**
   - ¿Variable de entorno en ambos servicios?
   - ¿Archivo de config?

## Impacto

**Bloqueante para:**
- Actualizar integración en Node.js backend
- Configurar CORS correctamente
- Documentar flujo de autenticación
- Testing E2E completo
- Deployment a producción

## Acción Requerida

**ANTES DE CONTINUAR:**
1. Definir flujo de autenticación (A, B, o C)
2. Documentar decisión con justificación
3. Actualizar README.md con arquitectura final
4. Implementar integración en Node.js
5. Testing E2E del flujo completo

## Referencias

- JWT Bridge Service: `/var/www/html/hawaii/asistencia/php-service/`
- Backend Node.js: `/var/www/html/hawaii/asistencia/backend/`
- Sistema Legacy: `/var/www/html/hawaii/*.php`
- CI/CD: `.github/workflows/ci.yml`

---

**Siguiente paso:** Reunión técnica para decidir arquitectura final
