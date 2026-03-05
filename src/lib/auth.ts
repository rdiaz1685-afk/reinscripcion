
import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { getAuthorizedUser } from "./auth-config";

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            const authorized = getAuthorizedUser(user.email);
            if (authorized) {
                return true;
            }
            return false; // Bloquea el acceso si no está en la lista o el dominio es incorrecto
        },
        async jwt({ token, user, account }) {
            if (user) {
                const authorized = getAuthorizedUser(user.email);
                if (authorized) {
                    token.rol = authorized.rol;
                    token.unidad = authorized.unidad;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).rol = token.rol;
                (session.user as any).unidad = token.unidad;
            }
            return session;
        },
    },
    pages: {
        signIn: "/", // Redirigir a la raíz para el login
        error: "/",  // Redirigir a la raíz en caso de error de auth
    },
};

export default NextAuth(authOptions);
