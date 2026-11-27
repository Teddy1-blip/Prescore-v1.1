export const clientStatuses = ['Новый клиент','Анализ готов','Подготовка заявки'];
export const applicationStatuses = ['Подготовка заявки','Подготовка документов','Требуются документы',
  'На рассмотрении у финансового партнёра','Предварительное решение','Одобрена','Выдана','Отклонена','Закрыта'];
export const closedStatuses = ['Выдана','Отклонена','Закрыта','Отменена клиентом'];
export const stages = [
  {label:'Новый',statuses:['Новый клиент','Новая']},
  {label:'Анализ',statuses:['Анализ готов']},
  {label:'Подготовка',statuses:['Подготовка','Подготовка заявки']},
  {label:'Документы',statuses:['Подготовка документов','Требуются документы']},
  {label:'У партнёра',statuses:['На рассмотрении у финансового партнёра']},
  {label:'Решение',statuses:['Предварительное решение','Одобрена']},
  {label:'Выдано / завершено',statuses:closedStatuses},
];
export function clientUrl(id:string, section='') {return '/agent/clients/'+encodeURIComponent(id)+(section?'/'+section:'');}
export function applicationUrl(id:string, section='') {return '/agent/applications/'+encodeURIComponent(id)+(section?'/'+section:'');}

// Read the same URL segment Next Link writes. Decode once so stored '%' and ':' stay distinct.
export function agentRecordId(pathname:string){
  const segment=pathname.split('/')[3]??'';
  try{return decodeURIComponent(segment);}catch{return '';}
}
