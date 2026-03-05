import { NextResponse } from "next/server";
import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/",
  },

  trustHost: true,
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth: session, request: { nextUrl } }) {
      const isLoggedIn = !!session?.user;
      const { pathname } = nextUrl;

      // These paths are public, accessible even if not logged in
      const publicPaths = ["/login", "/register"];
      const isPublicPath = publicPaths.includes(pathname);

      // API routes
      const isApiRoute = pathname.startsWith("/api");

      // Allow all /api/auth routes
      if (pathname.startsWith("/api/auth")) {
        return true;
      }

      if (pathname === "/api/health") {
        return true;
      }

      if (isLoggedIn) {
        // If logged in, redirect away from public pages (like /login)
        if (isPublicPath) {
          return NextResponse.redirect(new URL("/", nextUrl));
        }
        // Allow logged-in users to access everything else
        return true;
      }

      // User is not logged in
      if (!isLoggedIn) {
        // Allow access to public paths
        if (isPublicPath) {
          return true;
        }

        // For protected API routes, return 401 JSON response
        if (isApiRoute) {
          return NextResponse.json(
            { error: "You must be logged in to access this resource." },
            { status: 401 }
          );
        }

        // For all other protected pages, return false.
        // This will trigger a redirect to the `signIn` page
        // defined in your `authConfig`.
        // NextAuth automatically adds the `callbackUrl`.
        return false;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;

export const { auth } = NextAuth(authConfig);
