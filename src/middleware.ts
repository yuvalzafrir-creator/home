import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Redirect unauthenticated visitors to /login. This is a presence check only;
// the signed session is verified (and every query is scoped to the household)
// in the data layer via getSessionHouseholdId(). API routes are excluded here
// and self-guard with 401s.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!req.cookies.has("session") && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
