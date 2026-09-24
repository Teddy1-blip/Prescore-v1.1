'use client';
import type {ReactNode} from 'react';
import {WorkspaceShell,clientNav,brokerNav} from './shell';
export function ReportWorkspace({analysisId,labId,company,broker=false,children}:{analysisId?:string;labId?:string;company:string;broker?:boolean;children:ReactNode}){
 const query=analysisId?'analysisId='+encodeURIComponent(analysisId):'';
 const nav=broker?brokerNav.map(n=>({...n,href:'/agent#'+n.id})):clientNav.map(n=>({...n,href:labId?'/dashboard/workspace-lab?case='+encodeURIComponent(labId)+'&view='+n.id:'/dashboard?'+query+'&view='+n.id}));
 return <WorkspaceShell role={broker?'BROKER':'CLIENT'} active={broker?'clients':'report'} nav={nav} company={<><b>{company}</b><small>{broker?'Досье закреплённого клиента · только чтение':'Анализ Prescore'} · {analysisId?.slice(0,8)??labId}</small></>} synthetic={Boolean(labId)}><div className="wv-embedded-analysis">{children}</div></WorkspaceShell>;
}
