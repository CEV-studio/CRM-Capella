import { redirect } from 'next/navigation';

// Anciennes URL conservées pour les favoris des équipes qualité.
export default async function PreviousQualitySales({searchParams}:{searchParams:Promise<{vue?:string;agent?:string;centre?:string;q?:string}>}){
 const params=await searchParams;
 if(params.vue==='effectues')redirect('/qualite?'+new URLSearchParams({...(params.agent?{agent:params.agent}:{}),...(params.centre?{centre:params.centre}:{})}));
 redirect('/qualite/agents'+(params.agent||params.q?'?'+new URLSearchParams({q:params.agent||params.q||''}):''));
}
