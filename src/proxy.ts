import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["vadc_session", "__Host-vadc_session"];

/**
 * Filtre rapide : sans cookie de session, les pages d'administration redirigent
 * vers la connexion. La validation réelle de la session (base de données) est
 * faite côté serveur dans chaque page et chaque route d'API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
