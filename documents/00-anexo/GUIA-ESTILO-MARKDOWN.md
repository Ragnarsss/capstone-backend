# Guía de Estilo Markdown

---

## Objetivo y alcance

Esta guía define reglas mínimas y consistentes para redactar documentos Markdown en este repositorio. Prioriza legibilidad, consistencia y compatibilidad con linters comunes (MD001, MD022, MD026, MD031, MD032, MD040).

---

## Encabezados

- H1 solo una vez por documento (título principal).
- H2 para secciones principales; H3 para subsecciones. Incrementar de a un nivel (no saltar de H1 a H3).
- Sin puntuación al final del encabezado (evitar dos puntos).
- Dejar una línea en blanco antes y después de cada encabezado.

Ejemplo:

```markdown
# Título del Documento

## Sección

### Subsección
```

---

## Separadores entre secciones

- Usar `---` para separar secciones principales (entre H2 consecutivos).
- No usar separador antes del H1 ni después de la última sección.

---

## Cuerpo vs. encabezados

- Párrafos explicativos y labels van en texto normal o en negrita, no como encabezados.
- Evitar promover contenido de cuerpo a H4+ salvo que exista una jerarquía clara que lo justifique.

Ejemplo:

```markdown
**Nota:** Este texto es parte del cuerpo, no un encabezado.
```

---

## Listas

- Listas rodeadas por una única línea en blanco arriba y abajo, sin líneas adicionales.
- Usar `-` para bullets. Agregar un espacio tras el guion.
- Mantener consistencia en mayúsculas/minúsculas y puntuación al final de cada ítem.
- Para listas anidadas, indentar con dos espacios.

Ejemplo:

```markdown
Texto previo.

- Ítem uno
- Ítem dos
  - Ítem dos punto uno

Texto siguiente.
```

---

## Bloques de código

- Usar fenced code blocks con lenguaje siempre que sea posible (MD040): `python`, `cli`, `text`, `yaml`, `json`, etc.
- Dejar una línea en blanco antes y después del bloque (MD031).
- Para fragmentos cortos en línea, usar comillas invertidas: `codigo`.

Ejemplos:

```python
response = client.messages.create(model="sonnet", system=system_prompt)
```

```cli
podman compose up -d
```

```text
PoC: Cache distribuido para API
- Medir: latencia, hit rate
```

---

## Nomenclatura de ejemplos

- Encabezado H3 con formato: `### Ejemplo N - Descripción` (sin dos puntos al final).
- El contenido del ejemplo va dentro de un bloque de código con lenguaje `text` (salvo que sea código ejecutable).

Ejemplo:

```markdown
### Ejemplo 1 - Input Informal

\`\`\`text
Necesito probar X vs Y para Z
\`\`\`
```

---

## Enlaces y referencias

- Preferir rutas relativas dentro del repositorio.
- Usar texto descriptivo para los enlaces.
- Evitar nombres de archivo con espacios o acentos; usar guiones medios `-` o guiones bajos `_`.

Ejemplo:

```markdown
Consulta la [planificación](../../Biblioteca/02_Planificacion_Ejecucion/README.md).
```

---

## Nombres de archivo

- Evitar acentos y espacios. Preferir MAYÚSCULAS con guiones medios para guías generales (p. ej., `GUIA-ESTILO-MARKDOWN.md`).
- Para artefactos específicos, mantener la convención del proyecto (p. ej., `Prompt_PoC.md`).
- Para versiones, seguir el patrón usado en el repositorio: `(YYYYMMDD-Vn) Nombre.md` cuando corresponda.

---

## Notas

- Las notas en bloques de cita (blockquote) con listas deben usar el formato de blockquote sin espacios adicionales.
- Cada línea dentro del blockquote comienza con `>`, incluyendo las líneas vacías.

Ejemplo:

```markdown
> Nota
>
> - Elemento 1
> - Elemento 2
```

---

## Checklist rápida antes de guardar

- [ ] ¿H1 único? ¿H2/H3 incrementan de a uno?
- [ ] ¿Sin dos puntos al final de encabezados?
- [ ] ¿Separadores `---` entre secciones principales?
- [ ] ¿Listas con línea en blanco arriba y abajo?
- [ ] ¿Bloques de código con lenguaje y líneas en blanco alrededor?
- [ ] ¿Filenames sin acentos y sin espacios?

---

## Mini plantilla

```markdown
# Título del Documento

---

## Sección Principal

Texto introductorio.

### Ejemplo 1 - Descripción

```text
Contenido del ejemplo
```

---

## Otra Sección

- Punto 1
- Punto 2
