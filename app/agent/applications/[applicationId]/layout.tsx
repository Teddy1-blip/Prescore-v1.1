import {ApplicationRecord} from '../../_components/application-detail';
import type {ReactNode} from 'react';
export default async function Layout({children,params}:{children:ReactNode;params:Promise<{applicationId:string}>}){
  const {applicationId}=await params;
  return <ApplicationRecord id={applicationId}>{children}</ApplicationRecord>;
}
