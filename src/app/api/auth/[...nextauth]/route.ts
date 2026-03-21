
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Forzar Node.js runtime para compatibilidad con next-auth v4 en Next.js 16
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
