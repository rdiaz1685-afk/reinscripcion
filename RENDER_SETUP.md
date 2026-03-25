# Configuración de Render para Automatización de Innovat

## Problema Resuelto

La automatización de generación de archivos de Innovat no funcionaba en Render debido a:

1. **Variable de entorno incorrecta**: El código verificaba `RAILWAY_ENVIRONMENT` en lugar de `RENDER_ENVIRONMENT`
2. **Configuración de Chromium incompleta**: Faltaban argumentos críticos para entornos cloud
3. **Falta de archivo render.yaml**: No había configuración específica para Render

## Solución Implementada

### 1. Variables de Entorno Requeridas

Configura las siguientes variables en el Dashboard de Render:

```bash
# Entorno
NODE_ENV=production
RENDER_ENVIRONMENT=true

# Credenciales de Innovat (CRÍTICO - sin estos no funciona)
INNOVAT_USER=tu_usuario_innovat
INNOVAT_PASS=tu_contraseña_innovat
INNOVAT_SCHOOL=Colegio Cambridge de Monterrey

# Base URL de tu aplicación
NEXT_PUBLIC_BASE_URL=https://tu-app.onrender.com

# Database (si usas PostgreSQL en Render)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

### 2. Configuración de Chromium

El código ahora incluye argumentos específicos para Render:

- `--single-process`: Reduce uso de memoria en contenedores
- `--disable-blink-features=AutomationControlled`: Evita detección de automatización
- `--disable-dev-shm-usage`: Usa /tmp en lugar de /dev/shm (limitado en contenedores)

### 3. Archivo render.yaml

Se creó `render.yaml` con:
- Configuración de servicio web con Docker
- Health check en `/api/health`
- Variables de entorno predefinidas
- Configuración de base de datos

## Pasos para Deployment en Render

### Opción A: Usando render.yaml (Recomendado)

1. **Conecta tu repositorio** en Render Dashboard
2. Render detectará automáticamente `render.yaml`
3. **Configura las variables de entorno secretas**:
   - `INNOVAT_USER`
   - `INNOVAT_PASS`
   - `INNOVAT_SCHOOL`
   - `NEXT_PUBLIC_BASE_URL`

### Opción B: Configuración Manual

1. **Crear nuevo Web Service** en Render
2. **Runtime**: Docker
3. **Dockerfile Path**: `./Dockerfile`
4. **Build Command**: (vacío - manejado por Dockerfile)
5. **Start Command**: `bun run start`
6. **Variables de entorno**: Agregar todas las listadas arriba
7. **Health Check Path**: `/api/health`

## Verificación Post-Deployment

1. **Verifica que Chromium esté instalado**:
   - Los logs de build deben mostrar: "Installing Chromium..."
   
2. **Prueba el endpoint**:
   ```bash
   curl https://tu-app.onrender.com/api/sync-innovat
   ```

3. **Revisa los logs** en Render Dashboard:
   - Busca mensajes de `[InnovatAgent]`
   - Verifica que no haya errores de "chromium not found"

## Troubleshooting

### Error: "Chromium not found"
**Solución**: Verifica que el Dockerfile ejecute:
```dockerfile
RUN bunx playwright install chromium
RUN bunx playwright install-deps chromium
```

### Error: "Timeout waiting for Excel"
**Solución**: 
- Verifica las credenciales de Innovat
- Revisa que `RENDER_ENVIRONMENT=true` esté configurado
- Aumenta el timeout en render.yaml si es necesario

### Error: "Cannot write to /app/upload"
**Solución**: El Dockerfile ya crea estas carpetas:
```dockerfile
RUN mkdir -p /app/upload /app/tmp
```

### Error: "Database connection failed"
**Solución**: 
- Si usas SQLite: Asegúrate de que el volumen persista
- Si usas PostgreSQL: Verifica `DATABASE_URL`

## Límites de Render

- **Free Tier**: 512MB RAM, puede ser insuficiente para campus grandes
- **Timeout**: 30 segundos por defecto (configurable en paid plans)
- **Disk**: Efímero - los archivos se pierden al reiniciar (usa volúmenes persistentes)

## Recomendaciones

1. **Usa plan Starter o superior** para:
   - Más RAM (1GB+)
   - Timeouts más largos
   - Volúmenes persistentes

2. **Monitorea el uso de memoria**:
   - CUMBRES y ANAHUAC consumen más recursos
   - Considera procesar campus por lotes

3. **Configura alertas** en Render para:
   - Errores de deployment
   - Timeouts de API
   - Uso excesivo de memoria

## Archivos Modificados

- ✅ `src/lib/innovat-agent.ts` - Soporte para `RENDER_ENVIRONMENT`
- ✅ `render.yaml` - Configuración de deployment
- ✅ `Dockerfile` - Ya incluye instalación de Chromium
- ✅ `package.json` - Script de start con prisma push

## Próximos Pasos

1. Haz commit de los cambios:
   ```bash
   git add render.yaml src/lib/innovat-agent.ts RENDER_SETUP.md
   git commit -m "fix: Soporte para Render en automatización de Innovat"
   git push
   ```

2. Configura las variables de entorno en Render Dashboard

3. Despliega y verifica los logs

4. Prueba la sincronización desde el frontend
