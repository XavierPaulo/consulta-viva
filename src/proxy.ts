import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ADMIN = ["/admin/login", "/admin/recuperar", "/admin/redefinir"];

// Barreira rápida: sem cookie de sessão, nem chega a renderizar a área interna.
// A validação real da sessão (expiração, inatividade, usuário ativo) acontece no servidor em requireUser().
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_ADMIN.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (!req.cookies.get("cv_session")) {
    const url = new URL("/admin/login", req.url);
    if (pathname !== "/admin") url.searchParams.set("voltar", pathname);
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin/:path*"] };
