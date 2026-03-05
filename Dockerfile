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
# RUN bun run db:push # Opcional: Esto fallará si no hay DB en el build stage, se recomienda correrlo en el CMD o manualmente

# Crear carpetas necesarias
RUN mkdir -p /app/upload /app/tmp

# Build de Next.js
RUN bun run build

# Puerto que Railway asigna automáticamente
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Comando de inicio
CMD ["bun", "run", "start"]
