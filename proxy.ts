import {NextRequest,NextResponse}from'next/server';
export function proxy(request:NextRequest){
 if(request.nextUrl.pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method)){
  const origin=request.headers.get('origin'),base=process.env.PRESCORE_BASE_URL;
  if(!base||origin!==new URL(base).origin)return NextResponse.json({error:'Запрос не подтверждён. Обновите страницу.'},{status:403});
 }
 return NextResponse.next();
}
export const config={matcher:['/api/:path*']};
