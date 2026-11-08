import {ClientRecord} from '../../_components/client-detail';
import type {ReactNode} from 'react';
export default async function Layout({children,params}:{children:ReactNode;params:Promise<{clientId:string}>}){
  const {clientId}=await params;
  return <ClientRecord id={clientId}>{children}</ClientRecord>;
}
