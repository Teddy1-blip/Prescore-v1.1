const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const pad=(n:number)=>String(n).padStart(2,'0');
const iso=(y:number,m:number,d:number)=>y+'-'+pad(m)+'-'+pad(d);
function monthRange(y:number,m:number){return {from:iso(y,m,1),to:iso(y,m,new Date(Date.UTC(y,m,0)).getUTCDate())};}
export function oneCPeriod(title:string){
 const text=title.toLowerCase().replace(/ё/g,'е').split(/\s+за\s+/).at(-1)?.replace(/\s+г\.?/g,'').trim()??'';
 const interval=/^(\d{2})\.(\d{2})\.(\d{4})\s*[-–—]\s*(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
 if(interval){const from=interval[3]+'-'+interval[2]+'-'+interval[1],to=interval[6]+'-'+interval[5]+'-'+interval[4];return [from,to].every(v=>Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v)&&from<=to?{from,to}:null;}
 const q=/^([1-4])\s+квартал\s+(20\d{2})$/.exec(text);
 if(q){const m=Number(q[1])*3,y=Number(q[2]);return {from:monthRange(y,m-2).from,to:monthRange(y,m).to};}
 const parse=(s:string)=>{const m=/^([а-я]+)\s+(20\d{2})$/.exec(s.trim());if(!m)return null;const month=months.indexOf(m[1])+1;return month?monthRange(Number(m[2]),month):null;};
 const segments=text.split(/\s*[-–—]\s*/),first=parse(segments[0]),last=segments.length===1?first:segments.length===2?parse(segments[1]):null;
 return first&&last&&first.from<=last.to?{from:first.from,to:last.to}:null;
}
