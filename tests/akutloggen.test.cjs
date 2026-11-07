const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync(path.join(__dirname,'../akutloggen/index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];
async function app(t,existing){
 const dom=new JSDOM(html,{url:'http://localhost/akutloggen/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.scrollTo=()=>{};w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};
 if(existing)w.localStorage.setItem('akutloggen-v1',JSON.stringify(existing));
 const context=dom.getInternalVMContext();const run=s=>vm.runInContext(s,context);
 run(script);await new Promise(r=>setTimeout(r,10));
 t.after(()=>{run("accessibilityObserver.disconnect()");w.close()});return {w,run,doc:w.document,click:s=>w.document.querySelector(s).click(),data:()=>JSON.parse(w.localStorage.getItem('akutloggen-v1'))};
}
const tick=()=>new Promise(r=>setTimeout(r,10));
test('procedure outcome and role require confirmation, quick save survives reload',async t=>{
 const a=await app(t);a.run(`quickMode=true;form=blankCase('proc');form.procs=['Thoraxdrän'];form.sup='2b';show('fall');fillCase();`);
 await a.run('saveCase()');assert.equal(a.run('cases.length'),0);
 a.run(`form.details['procs:Thoraxdrän']={role:'Utförde'};`);await a.run('saveCase()');assert.equal(a.run('cases.length'),0);
 a.run(`form.details['procs:Thoraxdrän'].res='Ej lyckad';form.details['procs:Thoraxdrän'].tech='Kirurgisk';`);await a.run('saveCase()');
 assert.equal(a.data().cases.length,1);assert.equal(a.data().cases[0].details['procs:Thoraxdrän'].res,'Ej lyckad');assert.equal(a.run('view'),'home');
 const b=await app(t,a.data());assert.equal(b.run('cases.length'),1);assert.equal(b.run(`cases[0].details['procs:Thoraxdrän'].res`),'Ej lyckad');
 a.run('editCase(cases[0].id)');a.doc.querySelector('#f-title').value='Edited test';await a.run('saveCase()');assert.equal(a.data().cases.length,1);assert.equal(a.data().cases[0].title,'Edited test');
});
test('teaching attendance is not recorded as teaching EPA; night and weekend are separate',async t=>{
 const a=await app(t);a.run(`form=blankCase('teach');form.teachRole='Deltog';form.title='Pacing';form.date='2026-11-05';autoEpa(form);autoDm(form);show('fall');fillCase();`);await a.run('saveCase()');
 assert.equal(a.data().cases[0].teachRole,'Deltog');assert.equal(a.data().cases[0].epa.includes('9'),false);assert.equal(a.run(`SHIFT.includes('Natt / helg')`),false);
});
test('only performed clinical procedures count; simulation, assistance, teaching and unspecified roles stay separate',async t=>{
 const a=await app(t);a.run(`cases=['Utförde','Assisterade','Handledde annan','Observerade',''].map(role=>({...blankCase('proc'),procs:['Thoraxdrän'],details:{'procs:Thoraxdrän':{role,tech:'Kirurgisk'}}}));cases.push({...blankCase('proc'),site:'Simulering',procs:['Thoraxdrän'],details:{'procs:Thoraxdrän':{role:'Utförde',tech:'Seldinger'}}});`);
 const result=JSON.parse(a.run('JSON.stringify(skillCounts())'));assert.equal(result.done.Thoraxdrän,1);assert.equal(result.asst.Thoraxdrän,1);assert.equal(result.sim.Thoraxdrän,1);assert.equal(result.unknown.Thoraxdrän,1);
 const sub=JSON.parse(a.run(`JSON.stringify(targetCounts('Thoraxdrän'))`));assert.deepEqual(sub.map(r=>[r.min,r.count]),[[5,1],[5,0]]);
});
test('storage quota failure never reports successful save or drops the draft',async t=>{
 const a=await app(t);a.run(`form=blankCase('fall');form.title='Synthetic test';form.sup='4';show('fall');fillCase();draftChanged();`);
 const set=a.w.Storage.prototype.setItem;a.w.Storage.prototype.setItem=function(){throw new Error('quota')};
 await a.run('saveCase()');assert.equal(a.run('cases.length'),0);assert.equal(a.run('form.title'),'Synthetic test');assert.match(a.doc.querySelector('#toast').textContent,/Kunde inte spara/);a.w.Storage.prototype.setItem=set;
});
test('leaving the form immediately preserves and resumes the draft',async t=>{
 const a=await app(t);a.run(`form=blankCase('fall');show('fall');fillCase();`);a.doc.querySelector('#f-title').value='Draft test';a.run(`draftChanged();show('home')`);await tick();
 assert.equal(JSON.parse(a.w.localStorage.getItem('akutloggen-v1-draft')).form.title,'Draft test');assert.equal(a.doc.querySelector('#resumeCard').hidden,false);
 await a.run('restoreDraft()');assert.equal(a.doc.querySelector('#f-title').value,'Draft test');
});
test('backup round trip preserves settings, goals and unknown historical values; merge policies avoid silent overwrite',async t=>{
 const a=await app(t);const result=a.run(`settings={...settings,name:'Synthetic user',favorites:['pocus:eFAST'],skillGoals:{'US:eFAST':30}};cases=[{...blankCase('fall'),id:'a',date:'2026-11-05',title:'Original',updatedAt:'2026-11-05T12:00:00Z',shift:'Natt / helg'}];validateBackup(backupObject());JSON.stringify(backupObject())`);
 const b=JSON.parse(result);assert.equal(b.settings.skillGoals['US:eFAST'],30);assert.equal(b.cases[0].shift,'Natt / helg');
 a.run(`pendingImport=${result};`);a.doc.querySelector('#importMeta').checked=true;await a.run(`$('#confirmImport').onclick()`);assert.equal(a.data().meta.settings.name,'Synthetic user');
 const incoming={...b.cases[0],title:'Newer',updatedAt:'2026-11-06T12:00:00Z'};a.w.incoming=[incoming];
 assert.equal(a.run(`mergeRows(cases,incoming,'keep')[0].title`),'Original');assert.equal(a.run(`mergeRows(cases,incoming,'newer')[0].title`),'Newer');assert.equal(a.run(`mergeRows(cases,incoming,'replace').length`),1);
});
test('invalid import is rejected before any write',async t=>{
 const a=await app(t);for(const mutation of [`j.cases=[{id:'a',date:'2026-02-31',kind:'fall'}]`,`j.cases=[{id:'a',date:'2026-11-05',kind:'fall',procs:'bad'}]`,`j.wbas=[{id:'a',date:'2026-11-05',type:'Unknown'}]`,`j.settings={favorites:'not-array'}`,`j.version=999`]){
 assert.throws(()=>a.run(`(()=>{const j=backupObject();${mutation};return validateBackup(j)})()`));}assert.equal(a.w.localStorage.getItem('akutloggen-v1'),null);
});
test('labels, selected states and local plan are accessible',async t=>{
 const a=await app(t);a.run(`show('wba');fillWba();syncAccessibility()`);assert.equal(a.doc.querySelector('#w-assessor').getAttribute('aria-labelledby'),'w-assessor-label');
 const rating=a.doc.querySelector('.scale button');assert.match(rating.getAttribute('aria-label'),/Anamnes: 1 av 6/);
 a.run(`show('trappa');syncAccessibility()`);assert.equal(a.doc.querySelector('#ladder').hidden,true);assert.doesNotMatch(a.doc.querySelector('#epaList').textContent,/0\/4/);
 a.run(`settings.trainingTemplate='malmo';renderTrappa()`);assert.equal(a.doc.querySelector('#ladder').hidden,false);
});
test('PDF and Excel generation respect the selected period and include subtype evidence',async t=>{
 const a=await app(t);a.w.XLSX=require('xlsx');a.w.jspdf=require('jspdf');require('jspdf-autotable').applyPlugin(a.w.jspdf.jsPDF);
 a.run(`cases=[{...blankCase('proc'),id:'old',date:'2025-01-01',procs:['Thoraxdrän'],details:{'procs:Thoraxdrän':{role:'Utförde',res:'Lyckad',tech:'Kirurgisk'}}},{...blankCase('proc'),id:'new',date:'2026-11-05',procs:['Thoraxdrän'],details:{'procs:Thoraxdrän':{role:'Utförde',res:'Lyckad',tech:'Seldinger'}}}];show('export');$('#e-from').value='2026-01-01';offer=async(filename,data)=>{window.output={filename,data};return true;};`);
 await a.run(`$('#xlsx').onclick()`);let book=a.w.XLSX.read(a.w.output.data,{type:'array'});const rows=a.w.XLSX.utils.sheet_to_json(book.Sheets['Färdigheter'],{header:1});assert.equal(rows.find(r=>r[1]==='Thoraxdrän')[2],1);assert.equal(rows.find(r=>r[1]==='Thoraxdrän – Kirurgisk')[2],0);assert.equal(rows.find(r=>r[1]==='Thoraxdrän – Seldinger')[2],1);
 await a.run(`$('#pdf').onclick()`);assert.ok(a.w.output.data.byteLength>1000);assert.equal(Buffer.from(a.w.output.data).subarray(0,4).toString(),'%PDF');
});

test('automated accessibility checks cover all major views',async t=>{
 const a=await app(t);a.w.eval(require('axe-core').source);
 for(const view of ['home','fall','wba','trappa','delmal','fard','export','import']){
  a.run(`show('${view}');if(view==='fall')fillCase();if(view==='wba')fillWba();syncAccessibility()`);
  const result=await a.w.axe.run(a.doc,{rules:{'color-contrast':{enabled:false}}});
  assert.equal(result.violations.length,0,view+': '+JSON.stringify(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
 }
});
