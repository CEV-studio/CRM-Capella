import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { buildGmailAuthorizationUrl } from "@/lib/gmail";

function safeReturnTo(value: string | null, mode: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return mode === "shared" ? "/admin/boites-email" : "/email";
  }
  return value;
}

export async function GET(request: Request) {
  const profile = await requireProfile();
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "shared" ? "shared" : "personal";
  if (mode === "shared" && profile.role !== "admin") {
    return NextResponse.redirect(new URL("/?motif=acces-refuse", url.origin));
  }

  const origin = url.origin;
  const state = crypto.randomBytes(24).toString("base64url");
  const store = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  store.set("gmail_oauth_state", state, cookieOptions);
  store.set("gmail_oauth_mode", mode, cookieOptions);
  store.set("gmail_oauth_return", safeReturnTo(url.searchParams.get("return_to"), mode), cookieOptions);
  return NextResponse.redirect(buildGmailAuthorizationUrl(origin, state));
}
