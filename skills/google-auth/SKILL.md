---
name: google-auth-nextjs
description: Implementación estandarizada de autenticación con Google Auth usando NextAuth (Auth.js) en Next.js App Router, incluyendo manejo de roles y scopes de Google APIs.
---

# Google Auth + NextAuth Skill

Esta habilidad permite implementar rápidamente un sistema de autenticación robusto con Google en proyectos de Next.js.

## 1. Requisitos Previos

Instalar las dependencias necesarias:
```bash
npm install next-auth@beta
```

## 2. Variables de Entorno (.env)

Configurar las siguientes variables en el archivo `.env.local`:
- `AUTH_SECRET`: Secreto aleatorio (puedes generarlo con `openssl rand -base64 32`).
- `GOOGLE_CLIENT_ID`: Obtenido de Google Cloud Console.
- `GOOGLE_CLIENT_SECRET`: Obtenido de Google Cloud Console.

## 3. Configuración en Google Cloud Console

1. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Ir a **APIs & Services > Credentials**.
3. Crear un **OAuth 2.0 Client ID** de tipo "Web Application".
4. **Authorized Redirect URIs**: `http://localhost:3000/api/auth/callback/google` (ajustar para producción).
5. (Opcional) Habilitar APIs específicas como Google Sheets API si se requiere acceso a datos del usuario.

## 4. Estructura de Archivos Recomendada

### A. Configurador de Auth (`src/lib/auth.ts`)
Este archivo centraliza la lógica de proveedores y callbacks. Es vital para inyectar roles personalizados en la sesión.

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets.readonly",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: any, token: any }) {
      if (session.user) {
        // Lógica de roles personalizada aquí
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Ruta de login personalizada
  },
});
```

### B. Route Handler (`src/app/api/auth/[...nextauth]/route.ts`)
```typescript
import { handlers } from "@/lib/auth"
export const { GET, POST } = handlers
```

### C. Middleware de Protección (`src/middleware.ts`)
```typescript
export { auth as middleware } from "@/lib/auth"

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

## 5. Uso en Componentes

### Lado del Cliente
```tsx
import { useSession, signIn, signOut } from "next-auth/react"

// ... en el componente
const { data: session } = useSession()
```

### Lado del Servidor (Server Components)
```tsx
import { auth } from "@/lib/auth"

export default async function Page() {
  const session = await auth()
  if (!session) return <div>No autorizado</div>
  return <div>Bienvenido {session.user?.name}</div>
}
```
