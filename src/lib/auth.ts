
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
    secret: process.env.NEXTAUTH_SECRET || "cambridge-mty-reinscripcion-secret-2026",
    callbacks: {
        async signIn({ user }) {
            console.log("=== NEXTAUTH DEBUG: SIGNIN ===");
            console.log("Email:", user.email);
            const authorized = getAuthorizedUser(user.email);
            if (authorized) {
                console.log("Status: AUTHORIZED");
                return true;
            }
            console.log("Status: DENIED");
            return false;
        },
        async jwt({ token, user }) {
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
            if (session?.user) {
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
    debug: process.env.NODE_ENV !== 'production',
};

export default NextAuth(authOptions);
