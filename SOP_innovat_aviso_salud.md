# Manual de Usuario: Registro de Aviso de Salud en Innovat
## Proceso: Suministro de Medicamento a Alumno

**Sistema:** Innovat (innovat1.mx)
**Institución:** Colegio Cambridge de Monterrey
**Módulo:** Escolar > Operación > Avisos
**Área responsable:** Enfermería
**Duración estimada del proceso:** ~4 minutos
**Última actualización:** Marzo 2026

---

## Descripción General
Este proceso permite al personal de Enfermería generar un aviso formal dentro del sistema Innovat para **notificar a los padres de familia y solicitar su autorización** para el suministro de un medicamento a un alumno que presenta malestar durante la jornada escolar.

El aviso queda registrado digitalmente y se envía como notificación a la app Innovat del padre/madre/tutor.

---

## Requisitos Previos
- Tener acceso al sistema Innovat con perfil de Enfermería o Administrativo.
- Conocer el nombre completo o matrícula del alumno.
- Tener el nombre del medicamento y la dosis a suministrar.

---

## Paso a Paso

### PASO 1: Navegar al Módulo de Avisos
**Ruta:** Menú lateral izquierdo > Escolar > Operación > Avisos

1. Desde cualquier pantalla, ubica el **menú lateral izquierdo**.
2. Haz clic en **Escolar** para desplegar el submenú.
3. Dentro de Escolar, haz clic en **Operación** para expandir sus opciones.
4. Selecciona **Avisos**.
5. El sistema cargará el listado de avisos existentes.

> **Nota:** También verás otras opciones en el menú de Operación como: Inscripción/Reinscripción, Eventos y Baja de alumnos.

---

### PASO 2: Crear un Nuevo Aviso
1. En la pantalla de listado de Avisos, haz clic en el icono **+ (Agregar)** en la barra de herramientas.
2. Se abrirá el formulario de creación del aviso en una nueva vista.

---

### PASO 3: Completar el Campo "Asunto"
1. Haz clic en el campo **Asunto*** (obligatorio, marcado con asterisco).
2. Escribe el asunto del aviso. Ejemplo recommended:

`
Solicitud de autorización para administración de ibuprofeno
`

> **Tip:** El asunto debe ser claro y descriptivo ya que es lo primero que verá el padre de familia en la notificación.

---

### PASO 4: Redactar el Cuerpo del Mensaje
El sistema incluye un **editor de texto enriquecido** con opciones de formato (Editar, Insertar, Formato, Negrita, Cursiva, alineaciones, etc.).

El cuerpo del mensaje tiene una **plantilla base** que puede reutilizarse. El texto modelo observado en el video es:

`
Reciba un cordial saludo.

Por medio de la presente, le informamos que su hijo(a) [NOMBRE DEL ALUMNO] se
encuentra en Enfermería del colegio, presentando malestar que requiere atención básica 
para su estabilización.

Con el fin de ayudar a disminuir las molestias mientras usted puede acudir por él/ella,
atentamente su autorización para el suministro de ibuprofeno en dosis de 5ml.

Agradecemos nos confirme su autorización a la brevedad posible, ya que el menor 
requiere su consentimiento.

Quedamos atentos y a su disposición para cualquier duda o comentario.

Atentamente,
Área de Enfermería
`

**Variables que debes personalizar:**
- [NOMBRE DEL ALUMNO] → Nombre completo del alumno.
- ibuprofeno → Nombre del medicamento a suministrar.
- 5ml → Dosis específica.

---

### PASO 5: Seleccionar al Alumno Destinatario

**Sección: Destinatarios** (parte inferior del formulario)

1. En el campo desplegable **Alumno**, selecciona "Alumno".
2. En el campo de búsqueda de la derecha, escribe el **nombre o matrícula** del alumno.
   - Ejemplo: Buscar (2035) MONROY GARCIA REBECA ELEANA - 5PBMI
3. El sistema mostrará resultados en tiempo real. Selecciona al alumno correcto.
4. El nombre del alumno aparecerá como una **etiqueta azul** con una X para poder eliminarlo si es necesario.

> **Importante:** El número en paréntesis (2035) es la matrícula del alumno. La sigla final 5PBMI indica el grupo al que pertenece.

---

### PASO 6: Configurar los Detalles de Notificación

**Sección: Detalles**
- Campo **Seleccione las etiquetas**: Permite categorizar el aviso (opcional).
- Botón **Madre** / Padre: Indica a quién enviar la notificación. Se puede seleccionar ambos.

**Sección: Notificaciones**
- ✅ **Enviar notificación a INNOVAT ALUMNOS**: Asegúrate de que esta casilla esté **marcada** para que el aviso llegue a la app del padre/tutor.

**Sección: Archivos adjuntos**
- Icono de **clip** (📎): Permite adjuntar documentos o imágenes si es necesario (ej. foto de la receta médica).

**Sección: Tipo de publicación**
- **Aviso accesible a alumnos por inscribirse**: Casilla opcional (dejar desmarcada en este caso).

---

### PASO 7: Guardar y Publicar el Aviso
1. Revisa que todos los campos estén correctos.
2. Haz clic en el icono de **Guardar** (ícono de disco flexible / diskette) en la barra superior.
3. El sistema procesará y publicará el aviso inmediatamente.
4. El aviso aparecerá en el listado con **fecha y hora de publicación**.

---

## Campos del Formulario (Resumen)

| Campo | Tipo | ¿Obligatorio? | Descripción |
|---|---|---|---|
| Asunto | Texto libre | ✅ Sí | Título/asunto del aviso |
| Fecha de publicación | Selector de fecha | ✅ Sí | Por defecto: fecha actual |
| Cuerpo del mensaje | Editor rico | ✅ Sí | Mensaje completo para los padres |
| Destinatario - Tipo | Desplegable | ✅ Sí | "Alumno", "Familia", "Grupo", "Personal" |
| Destinatario - Nombre/Matrícula | Búsqueda | ✅ Sí | Nombre o matrícula del alumno |
| Etiquetas | Multi-selección | ❌ No | Categorizador del aviso |
| Enviar a (Madre/Padre) | Selector | ⚠️ Recomendado | Receptor específico de la notificación |
| Notificación INNOVAT ALUMNOS | Checkbox | ⚠️ Recomendado | Activa push notification en la app |
| Archivos adjuntos | Carga de archivo | ❌ No | Documentos o imágenes de soporte |

---

## Menú Lateral - Estructura del Sistema Innovat (Referencia)

`
📁 Expedientes
💲 Cobros
🏦 Interfase bancaria
📊 Calificaciones
🎓 Escolar
    ├── Catálogos
    ├── Configuración
    └── Operación  ← (ESTE PROCESO ESTÁ AQUÍ)
        ├── Inscripción / Reinscripción
        ├── Avisos  ← ✅ MÓDULO UTILIZADO
        ├── Eventos
        └── Baja de alumnos
    ├── Información Alumnos
    │   ├── General de alumnos
    │   ├── Lista de alumnos por grupo
    │   ├── Datos del alumno
    │   ├── Impresión de documentos
    │   └── Fotografías por grupo
    ├── Información Familias
    ├── Información Escolar
    └── Información Personal
`

---

## Notas Importantes
- El proceso dura aproximadamente **4 minutos** en ser completado.
- El padre/tutor recibe la notificación en **tiempo real** a través de la app Innovat.
- Este aviso queda **registrado permanentemente** en el sistema como evidencia del proceso de comunicación.
- La dosis y el medicamento deben ser **exactos y verificados** antes de enviar el aviso.

---
## Oportunidad de Automatización con IA
Este proceso es un candidato ideal para automatización parcial:

1. **Plantilla Inteligente:** La IA puede tener lista la plantilla del mensaje y solo solicitar:
   - Nombre del alumno
   - Medicamento
   - Dosis
2. **Búsqueda Automática:** Con la matrícula o nombre, la IA accede a Innovat, navega al módulo de Avisos y llena el formulario.
3. **Envío con Confirmación:** El personal de enfermería solo confirma con un "Sí, enviar" y la IA completa el resto.

**Ahorro estimado por proceso:** De 4 minutos manuales a 45 segundos asistidos.

---
*Documento generado con asistencia de IA Antigravity | Colegio Cambridge de Monterrey | Marzo 2026*
