import {PartnerList,type PartnerSearch} from '@/components/partner-list';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<PartnerSearch>}){return <PartnerList mode="opportunites" search={await searchParams}/>;}
