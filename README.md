# Sistema de Reinscripción Escolar

Sistema web para el seguimiento del proceso de reinscripción escolar, con cruce de datos entre ciclos escolares, métricas por grupo y exportación a PDF.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-SQLite-2D3748)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38B2AC)

## 📋 Características

- ✅ Importación de archivos Excel (ciclos 25-26 y 26-27)
- ✅ Clasificación automática de alumnos (Reinscritos, Transferencias, Bajas, Nuevos)
- ✅ Dashboard con KPIs en tiempo real
- ✅ Gráficos de distribución y avance por grupo
- ✅ Configuración de metas (porcentaje o número)
- ✅ Exportación a PDF
- ✅ Timeline de reinscripciones

## 🚀 Despliegue en Railway

### Opción 1: Desde GitHub (Recomendado)

1. **Subir a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Sistema de reinscripción escolar"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/reinscripcion.git
   git push -u origin main
   ```

2. **Conectar con Railway:**
   - Ve a [railway.app](https://railway.app)
   - Inicia sesión con GitHub
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Elige tu repositorio

3. **Configurar volumen persistente:**
   - En tu proyecto de Railway, ve a la pestaña "Volumes"
   - Click en "New Volume"
   - Monta el volumen en `/app/prisma`
   - Esto mantiene tu base de datos SQLite permanente

4. **Variables de entorno (opcional):**
   ```
   NODE_ENV=production
   ```

5. **¡Listo!** Railway te dará una URL como `tu-app.up.railway.app`

### Opción 2: Desde CLI

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Iniciar sesión
railway login

# Crear proyecto y desplegar
railway init
railway up

# Agregar volumen persistente
railway volume create
railway volume mount /app/prisma
```

## 💻 Desarrollo Local

### Requisitos previos
- Node.js 18+ o Bun
- Python 3 (para generación de PDFs)

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/TU_USUARIO/reinscripcion.git
cd reinscripcion

# Instalar dependencias
bun install

# Instalar reportlab para PDFs
pip3 install reportlab --break-system-packages

# Configurar base de datos
bun run db:push

# Iniciar servidor de desarrollo
bun run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## 📁 Estructura del Proyecto

```
├── prisma/
│   └── schema.prisma      # Esquema de base de datos
├── public/                 # Archivos estáticos
├── scripts/
│   └── generate_report_pdf.py  # Generador de PDF
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── page.tsx       # Página principal
│   │   └── layout.tsx     # Layout
│   ├── components/        # Componentes React
│   └── lib/               # Utilidades
├── upload/                # Archivos Excel subidos
├── Dockerfile             # Para Railway
└── package.json
```

## 📊 Uso del Sistema

1. **Subir archivos Excel:**
   - Ve a la pestaña "Config"
   - Sube el archivo `25-26.xlsx` (ciclo anterior)
   - Sube el archivo `26-27.xlsx` (ciclo actual)
   - Click en "Procesar Datos"

2. **Configurar metas:**
   - Dashboard → "Configurar Meta"
   - Elige entre porcentaje o número
   - Global o por grupo

3. **Exportar PDF:**
   - Pestaña "Por Grupo"
   - Click en "Exportar PDF"

## 🗄️ Base de Datos

El sistema usa SQLite con Prisma ORM. Los modelos principales:

- **Alumno25_26**: Alumnos del ciclo 2025-2026
- **Alumno26_27**: Alumnos del ciclo 2026-2027
- **AlumnoClasificado**: Alumnos clasificados con su estatus
- **MetaReinscripcion**: Metas de reinscripción

## ⚠️ Notas Importantes

### Para Railway (Volumen Persistente)
Es **obligatorio** montar un volumen en `/app/prisma` para que la base de datos SQLite persista entre despliegues. Sin esto, perderás los datos cada vez que Railway reinicie tu aplicación.

### Archivos Excel Requeridos
Los archivos Excel deben tener estas columnas:
- Matrícula
- Nombre del alumno
- Grupo
- Grado
- Unidad/Campus
- Estatus
- Fecha de estatus
- Comentarios

## 📝 Licencia

MIT

---

Desarrollado con ❤️ para seguimiento de reinscripción escolar
