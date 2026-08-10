import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function proxy(request: NextRequest) {
  const session = request.cookies.get("cogniflow_session");
  const isAuthPage = request.nextUrl.pathname.startsWith("/login");

  if (!session?.value && !isAuthPage) {
    if (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/projects") || request.nextUrl.pathname.startsWith("/entrega-final")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  if (session?.value && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/entrega-final", "/login"],
};
