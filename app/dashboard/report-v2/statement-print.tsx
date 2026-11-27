import {statementPrintBands} from '../../../lib/workspace/statement-print.ts';
import type {StatementMatrix} from '../../../lib/workspace/statement-matrix.ts';
export function StatementPrint({matrix}:{matrix:StatementMatrix}){
  return <section aria-label="Бухгалтерская отчётность по периодам">{statementPrintBands(matrix).map((band,index)=>
    <section key={index} className="cr-statement-band"><h2>{band.title}</h2><table style={{width:'100%',fontVariantNumeric:'tabular-nums'}}><thead><tr>{band.headers.map((h,i)=><th scope="col" key={i}>{h}</th>)}</tr></thead>
      <tbody>{band.rows.map(([name,...values])=><tr key={name}><th scope="row" style={{textAlign:'left'}}>{name}</th>{values.map((v,i)=><td key={i} style={{textAlign:'right'}}>{v}</td>)}</tr>)}</tbody></table>
      <p>{band.sources.join(' · ')}</p></section>)}</section>;
}
