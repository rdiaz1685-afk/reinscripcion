FROM oven/bun:1 AS base
WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# Instalar reportlab
RUN pip3 install reportlab --break-system-packages

# Copiar archivos
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Instalar dependencias
RUN bun install

# Copiar el resto
COPY . .

# Generar Prisma
RUN bun run db:generate
ENV DATABASE_URL="file:/app/prisma/dev.db"
RUN bun run db:push

# Crear carpetas necesarias
RUN mkdir -p /app/upload /app/tmp

# Build de Next.js
RUN bun run build

# Exponer puerto
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Comando de inicio
CMD ["bun", "run", "start"]
