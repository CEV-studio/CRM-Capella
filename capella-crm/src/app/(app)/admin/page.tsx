import { redirect } from "next/navigation";

export const metadata = { title: "Accueil admin — Capella CRM" };

export default function AdminPage() {
  redirect("/");
}
