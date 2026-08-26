import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { EmailAccount } from "@/lib/domain/database.types";

export type GmailPurpose = "read" | "send";

export async function getGmailAccountForProfile(
  profileId: string,
  purpose: GmailPurpose = "read",
): Promise<EmailAccount | null> {
  const admin = createAdminClient();

  // Une boîte personnelle du profil est toujours prioritaire.
  const { data: personal, error: personalError } = await admin
    .from("email_accounts")
    .select("*")
    .eq("owner_profile_id", profileId)
    .eq("is_shared", false)
    .eq("is_active", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (personalError) throw new Error(`Lecture de la boîte Gmail personnelle impossible : ${personalError.message}`);
  if (personal) return personal as EmailAccount;

  // Si le profil est propriétaire d'une boîte partagée, il peut également l'utiliser.
  const { data: ownedShared, error: sharedOwnerError } = await admin
    .from("email_accounts")
    .select("*")
    .eq("owner_profile_id", profileId)
    .eq("is_shared", true)
    .eq("is_active", true)
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sharedOwnerError) throw new Error(`Lecture de la boîte Gmail partagée impossible : ${sharedOwnerError.message}`);
  if (ownedShared) return ownedShared as EmailAccount;

  let membershipQuery = admin
    .from("email_account_members")
    .select("email_account_id, is_default")
    .eq("profile_id", profileId)
    .eq("can_read", true);
  if (purpose === "send") membershipQuery = membershipQuery.eq("can_send", true);

  const { data: memberships, error: membershipError } = await membershipQuery
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (membershipError) throw new Error(`Lecture des accès Gmail impossible : ${membershipError.message}`);
  if (!memberships?.length) return null;

  const ids = memberships.map((row) => row.email_account_id);
  const { data: sharedAccounts, error: accountsError } = await admin
    .from("email_accounts")
    .select("*")
    .in("id", ids)
    .eq("is_shared", true)
    .eq("is_active", true);
  if (accountsError) throw new Error(`Lecture des boîtes Gmail partagées impossible : ${accountsError.message}`);
  if (!sharedAccounts?.length) return null;

  const byId = new Map(sharedAccounts.map((account) => [account.id, account as EmailAccount]));
  for (const membership of memberships) {
    const account = byId.get(membership.email_account_id);
    if (account) return account;
  }
  return null;
}

export async function getGmailAccountById(accountId: string): Promise<EmailAccount | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw new Error(`Lecture de la boîte Gmail impossible : ${error.message}`);
  return data as EmailAccount | null;
}
