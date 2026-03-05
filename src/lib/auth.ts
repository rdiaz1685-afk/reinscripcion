
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
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async signIn({ user }) {
            console.log("Intentando signIn para:", user.email);
            const authorized = getAuthorizedUser(user.email);
            console.log("Resultado autorización:", authorized ? "AUTORIZADO" : "DENEGADO");
            if (authorized) {
                return true;
            }
            return false;
        },
        async jwt({ token, user, account }) {
            if (user) {
                console.log("Generando JWT para:", user.email);
                const authorized = getAuthorizedUser(user.email);
                if (authorized) {
                    token.rol = authorized.rol;
                    token.unidad = authorized.unidad;
                }
            }
            return token;
        },
        async session({ session, token }) {
            console.log("Generando sesión para:", session.user?.email);
            if (session.user) {
                (session.user as any).rol = token.rol;
                (session.user as any).unidad = token.unidad;
            }
            return session;
        },
    },
    pages: {
        signIn: "/",
        error: "/",
    },
    debug: true, // Activa el modo debug de NextAuth para ver más detalles en los logs de Railway
};

export default NextAuth(authOptions);
