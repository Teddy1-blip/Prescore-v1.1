import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createWorkspaceRuntime} from './fixtures/workspace-runtime.mjs';

test('presentation charts preserve unknown, zero, signs, ratio units and input immutability',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const {monthlyNet,factValue,concentrationPercent,FactBars,MonthlyChart}=rt.load('app/components/workspace/data-panel.tsx');
  const row={month:'2026-01',coverage:'PARTIAL',externalInflows:10,externalOutflows:25};
  const snapshot=structuredClone(row);assert.equal(monthlyNet(row),-15);assert.deepEqual(row,snapshot);
  assert.equal(monthlyNet({...row,externalInflows:null}),null);assert.equal(monthlyNet({...row,externalOutflows:null}),null);
  assert.equal(monthlyNet({...row,externalInflows:0,externalOutflows:0}),0);
  assert.equal(factValue({value:999,status:'UNKNOWN'}),null);
  assert.equal(concentrationPercent({value:.35,status:'KNOWN',unit:'RATIO'}),35);
  assert.equal(concentrationPercent({value:35,status:'KNOWN',unit:'PERCENT'}),35);
  assert.equal(concentrationPercent({value:35,status:'KNOWN',unit:'RUB'}),null);
  const render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
  for(const [value,copy] of [[null,'Недостаточно данных'],[0,'равны нулю']]){
   const html=render(FactBars,{rows:[{label:'Налоги',value}]});assert.ok(html.includes(copy));assert.doesNotMatch(html,/<i /);
   const chart=render(MonthlyChart,{rows:[{...row,externalInflows:value,externalOutflows:value}],net:true});assert.ok(chart.includes(copy));assert.doesNotMatch(chart,/<rect/);
  }
  const html=render(MonthlyChart,{rows:[row,{...row,month:'2026-02',externalInflows:null}],net:true});assert.match(html,/-15/);assert.match(html,/неполный месяц/);assert.match(html,/пропуски не означают ноль/);assert.match(html,/role="img"/);
  assert.doesNotMatch(render(FactBars,{rows:[{label:'Длинная сумма',value:999999999999999}]}),/NaN|Infinity/);
 }finally{await rt.close();}
});
test('broker distribution counts every actual status without fictional pipeline or lost cancellations',async()=>{
 const rt=await createWorkspaceRuntime();try{
  const {applicationDistribution,BrokerOverview}=rt.load('app/components/workspace/data-panel.tsx');
  const applications=[{status:'Требуются документы'},{status:'Отменена клиентом'},{status:'Требуются документы'},{status:'Новый фактический статус'}];
  assert.deepEqual(applicationDistribution(applications),[{label:'Требуются документы',value:2},{label:'Отменена клиентом',value:1},{label:'Новый фактический статус',value:1}]);
  const html=renderToStaticMarkup(React.createElement(BrokerOverview,{data:{leads:[{analysisId:'a'},{analysisId:null}],applications},attentionCount:3}));
  assert.match(html,/С анализом: 1; без анализа: 1/);assert.match(html,/отдельный счётчик задач/);assert.match(html,/не конверсия/);assert.match(html,/Отменена клиентом/);
  const empty=renderToStaticMarkup(React.createElement(BrokerOverview,{data:{leads:[],applications:[]},attentionCount:0}));assert.match(empty,/Заявок пока нет/);assert.doesNotMatch(empty,/NaN|Infinity/);
 }finally{await rt.close();}
});
