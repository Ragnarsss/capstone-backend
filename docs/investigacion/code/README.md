# Código Extraído de la Documentación

Este directorio contiene todos los bloques de código extraídos de la documentación del sistema de asistencia con QR fragmentado rotativo.

## Estructura

La estructura de carpetas refleja la estructura de documentación en [`../files/`](../files/):

```
code/
├── README.md (este archivo)
└── 02-arquitectura_del_sistema/
    ├── README.md
    ├── 2.3.1-totpu-generation.ts
    ├── 2.3.1-device-id-generation.ts
    ├── 2.3.2-totps-generation.ts
    ├── 2.3-validate-attendance.ts
    ├── 2.4.1-derive-handshake-secret.ts
    ├── 2.4.2-qr-generation.php
    ├── 2.4.3-attendance-scanner.ts
    ├── 2.4.4-attendance-validator.php
    ├── 2.4.5-qr-projection-manager.php
    └── 2.4.6-attendance-session-manager.php
```

## Convenciones de Nomenclatura

Los archivos de código siguen el patrón:

```
{sección}-{nombre-descriptivo}.{extensión}
```

Donde:
- **{sección}**: Número de sección en el documento (ej: `2.3.1`, `2.4.3`)
- **{nombre-descriptivo}**: Descripción corta del componente
- **{extensión}**: `.ts` (TypeScript), `.php` (PHP), `.js` (JavaScript)

## Mapeo Documentación ↔ Código

| Documento | Carpeta de Código | Estado |
|-----------|------------------|--------|
| [01-introduccion.md](../files/01-introduccion.md) | `01-introduccion/` | ⏳ Pendiente |
| [02-arquitectura_del_sistema.md](../files/02-arquitectura_del_sistema.md) | [02-arquitectura_del_sistema/](02-arquitectura_del_sistema/) | ✅ Completo |
| [03-analisis_de_viabilidad_tecnica.md](../files/03-analisis_de_viabilidad_tecnica.md) | `03-analisis_de_viabilidad_tecnica/` | ⏳ Pendiente |
| [04-escenarios_de_reconstruccion.md](../files/04-escenarios_de_reconstruccion.md) | `04-escenarios_de_reconstruccion/` | ⏳ Pendiente |
| [05-bibliotecas_y_herramientas.md](../files/05-bibliotecas_y_herramientas.md) | `05-bibliotecas_y_herramientas/` | ⏳ Pendiente |
| [06-arquitectura_alternativa_hibrida.md](../files/06-arquitectura_alternativa_hibrida.md) | `06-arquitectura_alternativa_hibrida/` | ⏳ Pendiente |
| [07-preguntas_criticas_pendientes.md](../files/07-preguntas_criticas_pendientes.md) | N/A | N/A (No contiene código) |
| [08-consideraciones_de_seguridad.md](../files/08-consideraciones_de_seguridad.md) | `08-consideraciones_de_seguridad/` | ⏳ Pendiente |
| [09-proof_of_concept.md](../files/09-proof_of_concept.md) | `09-proof_of_concept/` | ⏳ Pendiente |
| [10-conclusiones_y_recomendaciones.md](../files/10-conclusiones_y_recomendaciones.md) | N/A | N/A (No contiene código) |
| [11-referencias_y_recursos.md](../files/11-referencias_y_recursos.md) | N/A | N/A (No contiene código) |

## Uso de los Archivos de Código

### TypeScript/JavaScript

Los archivos `.ts` pueden contener:
1. **Código funcional**: Listo para usar con las dependencias apropiadas
2. **Pseudo-código**: Representaciones conceptuales que requieren adaptación

Para usar archivos TypeScript:

```bash
# Instalar dependencias
npm install @noble/hashes html5-qrcode jsqr

# Compilar TypeScript
tsc archivo.ts
```

### PHP

Los archivos `.php` están listos para uso con las dependencias apropiadas:

```bash
# Instalar dependencias
composer require bacon/bacon-qr-code spomky-labs/otphp

# Ejecutar
php archivo.php
```

## Notas Importantes

1. **Seguridad**: Los ejemplos asumen variables de entorno para secretos. **Nunca** hardcodear credenciales.

2. **Tipos**: Algunos archivos TypeScript requieren definiciones de tipos adicionales.

3. **Dependencias**: Verificar las dependencias necesarias en cada archivo README.

4. **Contexto**: Cada carpeta contiene un README.md con el mapeo detallado al documento fuente.

5. **Estado de desarrollo**: Este código es para **referencia y prototipado**. Requiere adaptación para producción.

## Extensiones de Archivo

- `.ts` - TypeScript (cliente/servidor Node.js)
- `.php` - PHP (backend)
- `.js` - JavaScript puro (si aplica)

## Contribuir

Para agregar código de otros documentos:

1. Crear carpeta con el mismo nombre que el archivo `.md`
2. Extraer bloques de código con nombres descriptivos
3. Crear README.md en la carpeta mapeando código ↔ documentación
4. Actualizar este archivo índice

---

**Última actualización**: 2025-10-25
**Documentos procesados**: 1/11
**Archivos de código**: 10
