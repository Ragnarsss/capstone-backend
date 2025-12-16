# REGLAS A MANTENER

## Principios de arquitectura

1. Mantener una arquitectura modular claramente definida.
2. Favorecer el *vertical slicing* frente a capas técnicas genéricas.
3. Mantener separación estricta de responsabilidades entre módulos y componentes.
4. Respetar un orden de inicialización explícito y consistente (infraestructura → módulos → extensiones/plugins).
5. Los cambios o migraciones entre módulos deben ser traslados de funcionalidad, no integraciones cruzadas.
6. El código, desde el nivel más bajo de abstracción hacia arriba, debe ser:

   * Desacoplado.
   * Altamente cohesivo.
   * Idempotente siempre que sea razonable.

## Estilo de implementación

7. Respetar los flujos ya establecidos antes de introducir variaciones.
8. Mantener patrones de acceso y uso coherentes con la estructura existente.
9. Priorizar implementaciones simples, explícitas y predecibles.
10. Evitar dependencias implícitas entre componentes.

## Stack y entorno de ejecución

11. Mantener el stack tecnológico definido para cada entorno.
12. Asumir entornos reproducibles y aislados (contenedores o equivalentes).
13. Reconstruir entornos cuando cambien dependencias o configuraciones.
14. Revisar siempre los archivos de definición del entorno para entender diferencias entre modos de desarrollo y producción.

## Reglas de desarrollo

15. Respetar flujos existentes antes de modificar o agregar funcionalidad.
16. No mezclar responsabilidades ni romper la segmentación modular.
17. Evitar soluciones ad-hoc que no sigan los patrones vigentes.

## Reglas de comentarios

18. Los comentarios deben ser concisos y pertinentes.
19. Deben servir como recordatorios o aclaraciones puntuales, no como documentación redundante.
20. Evitar ambigüedades, redundancias y ruido innecesario.

## Algoritmo de trabajo

21. Verificar siempre el estado inicial del código antes de comenzar.
22. Probar la funcionalidad antes de validar cualquier avance.
23. Realizar commits limpios con mensajes descriptivos.
24. Mantener un flujo consistente para planificación y continuidad de tareas.
25. Crear una rama nueva por cada tarea o cambio significativo.

## Flujo de trabajo incremental por fases

26. Trabajar en ramas descriptivas por fase o iteración.
27. Realizar commits atómicos por fase o subfase completada.
28. Usar un formato de commit consistente: `tipo(contexto): descripción breve`.
29. Preparar el *staging* de forma selectiva; evitar incluir cambios no relacionados.
30. Un commit debe representar una única unidad lógica de trabajo.
31. Cada fase debe contar con pruebas reproducibles y autocontenidas.
32. Probar funcionalidad manualmente antes de automatizar pruebas.
33. Usar prefijos claros para valores temporales o simulados.
34. Documentar explícitamente qué reemplazará cada elemento temporal y centralizarlos cuando sea posible.

---

Estas reglas deben aplicarse de forma consistente para asegurar coherencia, calidad técnica y mantenibilidad a largo plazo.
