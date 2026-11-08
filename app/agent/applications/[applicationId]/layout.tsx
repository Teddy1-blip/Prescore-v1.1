import {ApplicationRecord} from '../../_components/application-detail';
import type {ReactNode} from 'react';
export default function Layout({children}:{children:ReactNode}){
  return <ApplicationRecord>{children}</ApplicationRecord>;
}
