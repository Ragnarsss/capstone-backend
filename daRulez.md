# REGLAS A MANTENER

## Arquitectura

1. Mantener el monolito modular.
2. Respetar el enfoque de vertical slicing.
3. Mantener separación estricta de responsabilidades.
4. Respetar el orden definido en `app.ts`: infraestructura → módulos → plugin.
5. Las migraciones entre módulos deben ser traslados de funcionalidad sin integración cruzada.

## Estilo de implementación

6. Seguir los flujos ya establecidos dentro del módulo correspondiente.
7. Mantener patrones de acceso y uso coherentes con la estructura existente.
8. No usar emoticones ni emojis.

## Stack y entorno

9. Mantener el stack establecido:

* PHP 7.4 + Apache 2.4
* TypeScript + Vite (latest)
* Node 20 LTS + TypeScript
* Fastify (latest)
* PostgreSQL 18
* Valkey 7
* Podman/Docker (latest)

10. Considerar siempre que el host no contiene npm; toda instalación ocurre dentro de contenedores.
11. Usar `podman compose` (no `podman-compose`).
12. Reconstruir contenedores cuando cambien dependencias o configuraciones.
13. Revisar siempre el Containerfile y el archivo de `podman compose` del módulo para entender los modos dev y prod.

## Reglas de desarrollo

14. Respetar flujos existentes antes de modificar o agregar funcionalidad.
15. No mezclar responsabilidades ni romper la segmentación modular.
16. Mantener las implementaciones simples, claras y coherentes con los patrones actuales.

## Reglas de comentarios

17. Los comentarios deben ser concisos y pertinentes.
18. Deben ser recordatorios personales, no explicaciones innecesarias.
19. Evitar ambigüedades, redundancias y emoticones.

## Algoritmo de trabajo

20. Usar `git status` para verificar el estado inicial.
21. Probar siempre la funcionalidad antes de validar un avance.
22. Realizar commits limpios con mensajes descriptivos.
23. Mantener un flujo consistente para planificación y continuidad de tareas.
24. Crear ramas nuevas para cada tarea usando `git checkout -b <nombre>`.

---
Estas reglas deben ser seguidas estrictamente en todos los desarrollos futuros para asegurar la coherencia, calidad y mantenibilidad del proyecto.