import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildGmailAuthorizationUrl } from "@/lib/gmail";

export async function GET(request: Request) {
  await requireAdmin();
  const origin = new URL(request.url).origin;
  const state = crypto.randomBytes(24).toString("base64url");
  const store = await cookies();
  store.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
  return NextResponse.redirect(buildGmailAuthorizationUrl(origin, state));
}
