import {ClientRecord} from '../../_components/client-detail';
import type {ReactNode} from 'react';
export default function Layout({children}:{children:ReactNode}){
  return <ClientRecord>{children}</ClientRecord>;
}
