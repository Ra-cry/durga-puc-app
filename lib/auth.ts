import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        let adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        const inputUser = credentials.username.trim();
        const inputPass = credentials.password;

        if (inputUser !== adminUsername.trim()) {
          return null;
        }

        // 1. Direct password match
        if (adminPassword && inputPass === adminPassword) {
          return {
            id: '1',
            name: 'Admin',
            email: 'admin@durgapuc.local',
          };
        }

        // 2. Bcrypt hash match if provided
        if (adminPasswordHash) {
          if (adminPasswordHash.startsWith('"') && adminPasswordHash.endsWith('"')) {
            adminPasswordHash = adminPasswordHash.slice(1, -1);
          }
          if (adminPasswordHash.startsWith("'") && adminPasswordHash.endsWith("'")) {
            adminPasswordHash = adminPasswordHash.slice(1, -1);
          }

          const isValid = await bcrypt.compare(inputPass, adminPasswordHash);
          if (isValid) {
            return {
              id: '1',
              name: 'Admin',
              email: 'admin@durgapuc.local',
            };
          }
        }

        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'durga-puc-fallback-secret-2024',
};
