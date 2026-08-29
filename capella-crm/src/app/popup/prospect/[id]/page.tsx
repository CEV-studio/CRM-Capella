import FicheProspectPage from "../../../(app)/prospection/[id]/page";

export const dynamic = "force-dynamic";

export default function ProspectPopupPage({ params }: { params: Promise<{ id: string }> }) {
  return <FicheProspectPage params={params} searchParams={Promise.resolve({ popup: "1" })} />;
}
