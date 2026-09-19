import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Daftar email yang diizinkan masuk (tambahkan email temanmu di sini nanti)
const ALLOWED_EMAILS = [
  "yosiaamadeus@gmail.com", // GANTI DENGAN EMAIL GOOGLE MU!
  "temansatu@gmail.com"
];

const handler = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      // Jika email user ada di daftar ALLOWED_EMAILS, izinkan login
      if (user.email && ALLOWED_EMAILS.includes(user.email)) {
        return true;
      }
      // Jika tidak ada, tolak login
      return false;
    },
  },
  pages: {
    signIn: "/",
  },
});

export { handler as GET, handler as POST };