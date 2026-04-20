import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware para proteger las rutas de API de CCM HUB
 * 
 * Valida que las peticiones a /api/ccm-hub/* tengan una API Key válida
 */
export function middleware(request: NextRequest) {
  // Solo proteger rutas /api/ccm-hub/*
  if (request.nextUrl.pathname.startsWith('/api/ccm-hub')) {
    const apiKey = request.headers.get('x-api-key');
    const validKey = process.env.CCM_HUB_API_KEY;

    // Validar API Key
    if (!apiKey || !validKey || apiKey !== validKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - Invalid or missing API key',
        },
        { status: 401 }
      );
    }

    // Log de acceso (opcional)
    console.log(`[API] ${request.method} ${request.nextUrl.pathname} - Authorized`);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/ccm-hub/:path*',
};
