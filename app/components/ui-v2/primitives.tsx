import type{ReactNode,ButtonHTMLAttributes,InputHTMLAttributes,SelectHTMLAttributes,TextareaHTMLAttributes}from'react';
export function PageHeader({eyebrow,title,children,action}:{eyebrow?:string;title:string;children?:ReactNode;action?:ReactNode}){return <header className="pv-page-header"><div>{eyebrow&&<p className="pv-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{children&&<div className="pv-description">{children}</div>}</div>{action}</header>;}
export function SectionHeader({title,children}:{title:string;children?:ReactNode}){return <header className="pv-section-header"><h2>{title}</h2>{children}</header>;}
export function PrimaryAction(props:ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} className={'pv-button pv-primary '+(props.className??'')}/>;}
export function SecondaryAction(props:ButtonHTMLAttributes<HTMLButtonElement>){return <button {...props} className={'pv-button pv-secondary '+(props.className??'')}/>;}
export function Panel({children,label}:{children:ReactNode;label?:string}){return <section className="pv-panel" aria-label={label}>{children}</section>;}
export function Status({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'positive'|'attention'|'critical'|'data'}){return <span className={'pv-status pv-'+tone}>{children}</span>;}
export function Metric({label,value,note}:{label:string;value:ReactNode;note?:string}){return <div className="pv-metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>;}
export function DataRow({label,children}:{label:string;children:ReactNode}){return <div className="pv-data-row"><dt>{label}</dt><dd>{children}</dd></div>;}
export function EmptyState({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){return <section className="pv-empty"><h2>{title}</h2><p>{children}</p>{action}</section>;}
export function LoadingState({label='Загружаем данные'}:{label?:string}){return <div className="pv-loading" role="status"><span className="pv-skeleton"/>{label}</div>;}
export function ErrorState({children}:{children:ReactNode}){return <p className="pv-error" role="alert">{children}</p>;}
export function Input({label,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}){return <label className="pv-field">{label}<input {...props}/></label>;}
export function Select({label,children,...props}:SelectHTMLAttributes<HTMLSelectElement>&{label:string}){return <label className="pv-field">{label}<select {...props}>{children}</select></label>;}
export function Textarea({label,...props}:TextareaHTMLAttributes<HTMLTextAreaElement>&{label:string}){return <label className="pv-field">{label}<textarea {...props}/></label>;}
export function Disclosure({title,children}:{title:string;children:ReactNode}){return <details className="pv-disclosure"><summary>{title}</summary>{children}</details>;}
