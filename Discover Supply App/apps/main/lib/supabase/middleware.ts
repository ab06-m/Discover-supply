import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";

  if (isPrefetch) {
    return response;
  }

  const { pathname } = request.nextUrl;

  // Skip auth check entirely for public routes — avoids the Supabase network
  // round-trip on pages that don't need a session.
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/shop") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/i/") ||
    pathname.startsWith("/api/catalog") ||
    pathname.startsWith("/api/store") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/_next");

  if (isPublic) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: claimsData } = await supabase.auth.getClaims();
  const hasUser = Boolean(claimsData?.claims.sub);

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");

  if (!hasUser && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasUser && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
