-- Crear tablas en Turso basadas en el schema de Prisma

CREATE TABLE IF NOT EXISTS "Alumno25_26" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "grado" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Alumno25_26_matricula_unidad_key" ON "Alumno25_26"("matricula", "unidad");

CREATE TABLE IF NOT EXISTS "Alumno26_27" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "grado" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "estatus" TEXT NOT NULL,
    "fechaEstatus" DATETIME,
    "comentario" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "Alumno26_27_matricula_unidad_key" ON "Alumno26_27"("matricula", "unidad");

CREATE TABLE IF NOT EXISTS "MetaReinscripcion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "unidadAsignada" TEXT NOT NULL DEFAULT '',
    "grupo" TEXT NOT NULL DEFAULT '',
    "mes" INTEGER NOT NULL DEFAULT 3,
    "meta" INTEGER NOT NULL,
    "tipoMeta" TEXT DEFAULT 'numero',
    "valorMeta" REAL DEFAULT 0,
    "creadaPorRol" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "MetaReinscripcion_meta_unique_key" ON "MetaReinscripcion"("tipo", "unidadAsignada", "grupo", "mes", "creadaPorRol");

CREATE TABLE IF NOT EXISTS "AlumnoClasificado" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "grado" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "estatus" TEXT NOT NULL,
    "fechaEstatus" DATETIME,
    "comentario" TEXT,
    "clasificacion" TEXT NOT NULL,
    "fechaClasificacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlumnoClasificado_matricula_unidad_key" ON "AlumnoClasificado"("matricula", "unidad");

CREATE TABLE IF NOT EXISTS "SnapshotMetricas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unidad" TEXT NOT NULL,
    "reinscritos" INTEGER NOT NULL,
    "bajasTransferencia" INTEGER NOT NULL,
    "bajasReales" INTEGER NOT NULL,
    "porReinscribir" INTEGER NOT NULL,
    "nuevos" INTEGER NOT NULL,
    "candidatos" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "meta" INTEGER NOT NULL,
    "porcentajeCumplimiento" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "nombre" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "unidad" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
