/**
 * Isolated render-branch regression tests for the actual ClientWorkspace source.
 * React hooks and child components are stubbed deliberately: these tests exercise
 * selection/model-error gates, not React lifecycle, browser layout, auth or APIs.
 * Run separately from live acceptance and the full product/browser test suites.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const sourceRoot = process.env.CLIENT_NAV_SOURCE_ROOT ?? process.cwd();
const filename = path.join(sourceRoot, 'app/components/workspace/client.tsx');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
 fileName: filename,
 reportDiagnostics: true,
 compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
});
const parseErrors = compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [];
assert.deepEqual(parseErrors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,'\n')),[]);

const company = {id:'owned-analysis',companyName:'Owned company',companyInn:'9900000012',createdAt:'2026-10-20',periodFrom:'2026-01-01',periodTo:'2026-06-30'};
const names = new Map();
function component(name) {
 if (!names.has(name)) {const f=()=>null; f.displayName=name; names.set(name,f);}
 return names.get(name);
}
function harness({view='home',selectedId='',analyses=[company],model=null,modelError='',modelLoading=false,readOnly=false,modules={},workspaceError='',diagnostic=''}={}) {
 const values=[analyses,[],selectedId,view,false,workspaceError,'',readOnly,0,modules,false,'',false,null];
 let hook=0;
 const location={href:'https://prescore.test/dashboard'};
 const window={location,history:{replaceState(_state,_title,url){location.href=String(url);}}};
 const modelState={model,diagnostic,error:modelError,refreshError:'',loading:modelLoading,refreshing:false,refresh:async()=>true};
 const react={
  useState(initial){const index=hook++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return [values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];},
  useRef:value=>({current:value}),useCallback:fn=>fn,useEffect(){},
 };
 const jsx=(type,props,key)=>({type,props:props??{},key});
 const exports={};
 const sandbox={module:{exports},exports,window,URL,URLSearchParams,console,Map,Set,AbortController,setTimeout,clearTimeout,crypto:globalThis.crypto};
 sandbox.require=id=>{
  if(id==='react')return react;
  if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'Fragment'};
  if(id==='./use-model')return {useWorkspaceModel:()=>modelState,selectAnalysis:id=>{const u=new URL(location.href);u.searchParams.set('analysisId',id);location.href=String(u);}};
  if(id.endsWith('.css'))return {};
  return new Proxy({__esModule:true},{get:(target,key)=>{
   if(key in target)return target[key];
   if(key==='date')return value=>value??'';
   if(key==='sourceState')return value=>value;
   return component(key==='default'?path.basename(id):String(key));
  }});
 };
 vm.runInNewContext(compiled.outputText,sandbox,{filename});
 return {render(){hook=0;return sandbox.module.exports.default();},values,modelState,window};
}
function nodes(tree) {
 const result=[];
 function walk(node){
  if(Array.isArray(node)){node.forEach(walk);return;}
  if(!node||typeof node!=='object')return;
  if('type'in node){result.push(node);walk(node.props?.children);walk(node.props?.context);}
 }
 walk(tree);return result;
}
const named=(tree,name)=>nodes(tree).filter(n=>(typeof n.type==='function'?n.type.displayName:n.type)===name);
function text(tree){
 if(tree==null||typeof tree==='boolean')return '';
 if(typeof tree==='string'||typeof tree==='number')return String(tree);
 if(Array.isArray(tree))return tree.map(text).join(' ');
 return text(tree.props?.children);
}
function readyModel(){return {access:{readOnly:false},entitlement:'FULL',basic:{analysis:{company:{name:company.companyName,inn:company.companyInn},period:{from:'2026-01-01',to:'2026-06-30'}},sources:{statements:{status:'READY'}},bankingFacts:{topCounterparties:[]}},full:{report:{financialAnalysis:{history:[]}}}};}

test('home still starts without selecting a historical analysis',()=>{
 const h=harness(),tree=h.render();
 assert.equal(named(tree,'EmptyHome').length,1);
 assert.equal(named(tree,'ClientOverview').length,0);
 assert.equal(h.values[2],'');
});
test('clicking Finance without an analysis changes content, not only the highlighted menu',()=>{
 const h=harness();
 named(h.render(),'ClientShell')[0].props.choose('banking');
 const tree=h.render();
 assert.equal(h.values[3],'banking');
 assert.equal(new URL(h.window.location.href).searchParams.get('view'),'banking');
 assert.equal(named(tree,'EmptyHome').length,0);
 assert.ok(named(tree,'Panel').some(n=>n.props.title==='Финансы'));
 assert.match(text(tree),/Выберите сохранённый анализ/);
});
for(const [view,title]of Object.entries({analysis:'Анализ Prescore',banking:'Финансы',obligations:'Обязательства',financing:'Финансирование',documents:'Документы',applications:'Заявки',analyst:'Кредитный аналитик',billing:'Подписка компании'})){
 test(`unselected ${view} has its own section title and explicit company selection`,()=>{
  const tree=harness({view}).render();
  assert.equal(named(tree,'EmptyHome').length,0);
  assert.ok(named(tree,'Panel').some(n=>n.props.title===title));
  assert.equal(named(tree,'FullCreditAnalysis').length,0);
  assert.equal(named(tree,'SourceUpload').length,0);
 });
}
for(const failure of [{modelError:'Model unavailable'},{modelLoading:true}]){
 test(`documents remain reachable with ${failure.modelError?'failed':'loading'} analytical model`,()=>{
  const tree=harness({view:'documents',selectedId:company.id,...failure}).render();
  assert.deepEqual(named(tree,'SourceUpload').map(n=>n.props.kind).sort(),['BFO','BKI','QUARTERLY']);
  assert.equal(named(tree,'documents-hub').length,1);
  assert.equal(named(tree,'DocumentSources').length,0,'do not pass null to model-only summary');
 });
}
test('BKI upload remains reachable in Obligations when the analytical model fails',()=>{
 const tree=harness({view:'obligations',selectedId:company.id,modelError:'Model unavailable'}).render();
 assert.deepEqual(named(tree,'SourceUpload').map(n=>n.props.kind),['BKI']);
 assert.equal(named(tree,'DebtPortfolio').length,0);
 assert.match(text(tree),/Обязательства/);
});
test('applications are not gated on the analytical model',()=>{
 const tree=harness({view:'applications',selectedId:company.id,modelError:'Model unavailable'}).render();
 assert.equal(named(tree,'Crm').length,1);
 assert.equal(named(tree,'RecipientApplications').length,1);
});
test('billing can load its own API without the analytical model',()=>{
 const tree=harness({view:'billing',selectedId:company.id,modelError:'Model unavailable'}).render();
 assert.equal(named(tree,'ClientBilling').length,1);
});
test('read-only documents remain readable without exposing any source upload',()=>{
 const tree=harness({view:'documents',selectedId:company.id,modelError:'Model unavailable',readOnly:true}).render();
 assert.equal(named(tree,'SourceUpload').length,0);
 assert.equal(named(tree,'CompanyData').length,0);
 assert.equal(named(tree,'documents-hub')[0]?.props.readOnly,true);
});
test('model fetch does not hide the new-analysis entry point',()=>{
 const tree=harness({view:'analysis',selectedId:company.id,modelLoading:true}).render();
 assert.ok(named(tree,'ClientShell')[0].props.availableViews.includes('upload'));
});
test('analytics still fail closed on model error',()=>{
 const tree=harness({view:'analysis',selectedId:company.id,modelError:'Model unavailable'}).render();
 assert.equal(named(tree,'FullCreditAnalysis').length,0);
 assert.match(text(tree),/Model unavailable/);
});
test('a missing explicit analysis ID never selects another saved analysis',()=>{
 const h=harness({view:'documents',selectedId:'not-owned'}),tree=h.render();
 assert.equal(h.values[2],'not-owned');
 assert.equal(named(tree,'SourceUpload').length,0);
 assert.match(text(tree),/другой анализ автоматически не подставляется/);
});
test('disabled module is not opened by the document recovery path',()=>{
 const tree=harness({view:'documents',selectedId:company.id,modules:{documents:false},modelError:'Model unavailable'}).render();
 assert.equal(named(tree,'SourceUpload').length,0);
 assert.match(text(tree),/Раздел временно недоступен/);
});
test('ready analytics receive the original canonical model without modification',()=>{
 const model=readyModel(),before=JSON.stringify(model);
 const tree=harness({view:'analysis',selectedId:company.id,model}).render();
 assert.equal(named(tree,'FullCreditAnalysis')[0]?.props.model,model);
 assert.equal(JSON.stringify(model),before);
});
test('new statement upload does not depend on a previously selected model',()=>{
 const tree=harness({view:'upload',selectedId:company.id,modelError:'Model unavailable'}).render();
 assert.equal(named(tree,'Analyze').length,1);
});
test('read-only user cannot open the statement upload form',()=>{
 const tree=harness({view:'upload',selectedId:company.id,readOnly:true}).render();
 assert.equal(named(tree,'Analyze').length,0);
});

test('choosing a company opens the requested Finance section without changing company implicitly',()=>{
 const h=harness({view:'banking'});
 const button=nodes(h.render()).find(n=>n.type==='button'&&text(n).includes(company.companyName));
 assert.ok(button);
 button.props.onClick();
 h.modelState.model=readyModel();
 const tree=h.render();
 assert.equal(h.values[2],company.id);
 assert.equal(h.values[3],'banking');
 assert.equal(new URL(h.window.location.href).searchParams.get('analysisId'),company.id);
 assert.equal(named(tree,'BankingLedger').length,1);
 assert.equal(named(tree,'EmptyHome').length,0);
});
test('an empty Documents section offers a working route to statement upload',()=>{
 const h=harness({view:'documents',analyses:[]});
 const button=nodes(h.render()).find(n=>n.type==='button'&&text(n).includes('Создать анализ по выписке'));
 assert.ok(button);
 button.props.onClick();
 assert.equal(named(h.render(),'Analyze').length,1);
 assert.equal(h.values[2],'');
});
test('ready Documents retains both analytical source summary and upload forms',()=>{
 const tree=harness({view:'documents',selectedId:company.id,model:readyModel()}).render();
 assert.equal(named(tree,'DocumentSources').length,1);
 assert.deepEqual(named(tree,'SourceUpload').map(n=>n.props.kind).sort(),['BFO','BKI','QUARTERLY']);
});
test('model-provided read-only access is still enforced in operational sections',()=>{
 const model=readyModel();model.access.readOnly=true;
 const tree=harness({view:'documents',selectedId:company.id,model}).render();
 assert.equal(named(tree,'SourceUpload').length,0);
 assert.equal(named(tree,'CompanyData').length,0);
 assert.equal(named(tree,'documents-hub')[0]?.props.readOnly,true);
});


test('diagnostic is visible in Documents without hiding the three analytical upload forms',()=>{
 const h=harness({view:'documents',selectedId:company.id,modelError:'Model unavailable',diagnostic:'Safe processing diagnostic'}),tree=h.render();
 assert.equal(nodes(tree).filter(n=>n.props?.['data-workspace-diagnostic']).length,1);
 assert.match(text(tree),/Safe processing diagnostic/);
 assert.deepEqual(named(tree,'SourceUpload').map(n=>n.props.kind).sort(),['BFO','BKI','QUARTERLY']);
});
test('no diagnostic is shown for an unselected or inaccessible analysis',()=>{
 for(const selectedId of ['', 'not-owned']){
  const tree=harness({view:'documents',selectedId,diagnostic:'Previous analysis diagnostic'}).render();
  assert.equal(nodes(tree).filter(n=>n.props?.['data-workspace-diagnostic']).length,0);
  assert.doesNotMatch(text(tree),/Previous analysis diagnostic/);
 }
});
test('read-only diagnostic does not expose mutation controls',()=>{
 const tree=harness({view:'documents',selectedId:company.id,readOnly:true,modelError:'Model unavailable',diagnostic:'Safe processing diagnostic'}).render();
 assert.match(text(tree),/Safe processing diagnostic/);
 assert.equal(named(tree,'SourceUpload').length,0);
 assert.equal(named(tree,'CompanyData').length,0);
});

test('removed or unselected analysis cannot leak a cached company into the header or sections',()=>{
 for(const view of ['home','documents','analysis'])for(const selectedId of ['',company.id]){
  const model=readyModel(),before=JSON.stringify(model),tree=harness({view,analyses:[],selectedId,model}).render();
  const shell=named(tree,'ClientShell')[0];
  assert.doesNotMatch(JSON.stringify(shell.props.context),/Owned company|9900000012/);
  assert.doesNotMatch(text(tree),/Owned company|9900000012/);
  assert.equal(named(tree,'DocumentSources').length,0);assert.equal(named(tree,'FullCreditAnalysis').length,0);
  assert.equal(JSON.stringify(model),before);
 }
});

test('QA lives in a separate disclosure and explicit selector group; work with QA in its name remains work',()=>{
 const control={...company,id:'test-control',companyName:'Control company',historyPurpose:'QA'};
 const work={...company,companyName:'QA real working company',historyPurpose:'WORK'};
 const tree=harness({analyses:[control,work]}).render();
 const history=named(tree,'Panel').find(n=>n.props.title==='Последние активные анализы');
 assert.match(text(history),/QA real working company/);assert.doesNotMatch(text(history),/Control company/);
 const disclosure=named(tree,'details').find(n=>n.props.className==='pc-test-history');
 assert.match(text(disclosure),/Control company/);assert.match(text(disclosure),/Тестовые данные/);
 assert.deepEqual(named(tree,'optgroup').map(n=>n.props.label),['Рабочие компании','Тестовые данные']);
});
test('starting a new analysis clears the selected company and does not persist a phantom record',()=>{
 const h=harness({selectedId:company.id,model:readyModel()});
 named(h.render(),'ClientShell')[0].props.choose('upload');
 const tree=h.render();assert.equal(h.values[2],'');assert.equal(h.values[0].length,1);
 assert.equal(new URL(h.window.location.href).searchParams.has('analysisId'),false);
 assert.equal(named(tree,'Analyze').length,1);
 const header=nodes(tree).find(n=>n.props.className==='pc-company');
 assert.doesNotMatch(text(header),/Owned company/);
 assert.equal(named(tree,'select')[0].props.value,'');
});
