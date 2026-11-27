import type {ReactNode} from 'react';
export function Panel({title,action,children,id}:{title:string;action?:ReactNode;children:ReactNode;id?:string}){return <section className="pc-panel" id={id}><header><h2>{title}</h2>{action}</header>{children}</section>;}
