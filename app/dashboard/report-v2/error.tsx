'use client';
import {ReportState} from './primitives.tsx';
export default function ReportError({reset}:{reset:()=>void}){return <div className="cr-report"><ReportState state="unavailable"/><button type="button" className="cr-print-button" onClick={reset}>Повторить открытие отчета</button></div>;}
