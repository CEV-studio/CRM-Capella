import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { buildCalendarAuthorizationUrl } from "@/lib/calendar";

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/agenda";
  return value;
}

export async function GET(request: Request) {
  await requireProfile();
  const url = new URL(request.url);
  const origin = url.origin;
  const state = crypto.randomBytes(24).toString("base64url");
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const store = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  store.set("calendar_oauth_state", state, cookieOptions);
  store.set("calendar_oauth_return", returnTo, cookieOptions);
  return NextResponse.redirect(buildCalendarAuthorizationUrl(origin, state));
}
