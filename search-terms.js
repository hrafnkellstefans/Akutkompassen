/* Akutkompassen – shared search vocabulary for Vuxna and Barn.
   Each group lists words that should find each other: Swedish and English terms, abbreviations,
   brand names and generic names. One word may sit in several groups. Keep entries to single words:
   the search works word by word. Spelling with or without å/ä/ö does not matter. */
(function(root){
 'use strict';
 const GROUPS=[
  // Cardiovascular
  ['lungemboli','lungembolism','embolism','pulmonary'],
  ['dvt','ventrombos','vte','tromboembolism','tromboembolisk'],
  ['ff','af','förmaksflimmer','förmaksfladder','afib','fibrillation'],
  ['aks','koronart','stemi','nstemi','acs','hjärtinfarkt','myokardinfarkt','coronary'],
  ['bröstsmärta','bröstsmärtor','chest'],
  ['hjärtsvikt','hjärtsvikten'],
  ['arytmi','arytmier','arrhythmia','dysrhythmia','dysrytmi'],
  ['svt','supraventrikulär'],
  ['pacemaker','pacing'],
  ['aortadissektion','dissektion','dissection'],
  ['synkope','svimning','svimmat','syncope'],
  ['hypertoni','hypertension'],
  ['hjärtstopp','arrest','hlr','cpr','återupplivning','resuscitation'],
  // Neurology
  ['stroke','slaganfall','hjärninfarkt'],
  ['trombolys','thrombolysis','alteplas','alteplase','tenekteplas','tenecteplase','reperfusion','reperfusionsbehandling'],
  ['sah','subaraknoidalblödning','subarachnoid'],
  ['tia','transitorisk'],
  ['kramp','kramper','krampanfall','epilepsi','epileptiskt','epileptiska','epilepticus','seizure','seizures','anfall'],
  ['feberkramp','feberkramper'],
  ['yrsel','vertigo','dizziness','svindel'],
  ['huvudvärk','headache','cefalgi','migrän'],
  ['meningit','hjärnhinneinflammation','meningitis'],
  ['encefalit','encephalitis'],
  ['tbi','skallskada','skallskador','hjärnskada','skalltrauma','hjärnskakning','commotio'],
  ['lp','lumbalpunktion','lumbar'],
  // Infection
  ['sepsis','septisk','septic','urosepsis'],
  ['feber','fever','febril','febrile','pyrexia'],
  ['uvi','urinvägsinfektion','urinvägsinfektioner','uti','pyelonefrit','cystit'],
  ['pneumoni','lunginflammation','pneumonia'],
  ['halsont','halsfluss','tonsillit','peritonsillit','faryngit','throat'],
  ['kikhosta','pertussis'],
  ['bronkiolit','rsv','bronchiolitis'],
  ['krupp','pseudokrupp','croup','laryngit'],
  ['gastroenterit','magsjuka','gastroenteritis'],
  ['neutropeni','neutropen','neutropenia'],
  ['borrelia','borrelios','fästing'],
  // Respiratory and airway
  ['kol','copd'],
  ['astma','asthma'],
  ['ards'],
  ['niv','bipap','cpap','noninvasiv'],
  ['högflöde','högflödesgrimma','hfnc','hfno','optiflow'],
  ['rsi','intubation','intubering','snabbinduktion'],
  ['luftväg','luftvägen','airway','luftvägshantering'],
  ['pneumothorax','pneumotorax','ptx'],
  ['syrgas','oxygen'],
  ['andningssvikt','respirationssvikt','respiratorisk','respiratory','hypoxemi','hypoxi'],
  ['andningsbesvär','dyspné','andnöd','andfåddhet','dyspnea','dyspnoea'],
  // Abdomen, kidney, urology
  ['gi','gastrointestinal','gastrointestinala'],
  ['appendicit','blindtarmsinflammation','appendicitis'],
  ['kolecystit','gallblåseinflammation','cholecystitis'],
  ['gallsten','gallstenssjukdom','gallstensanfall','kolelitiasis'],
  ['divertikulit','diverticulitis'],
  ['pankreatit','pancreatitis'],
  ['ileus','tarmvred'],
  ['invagination','intussusception'],
  ['aki','njursvikt','njurskada','kidney'],
  ['njursten','uretärsten','njurkolik','urolithiasis'],
  ['kad','urinkateter','urinstämma','urinretention'],
  ['testistorsion','torsion','testis','skrotum','scrotum'],
  // Metabolic and electrolytes
  ['dka','ketoacidos','ketoacidosis'],
  ['hhs','hyperosmolärt','hyperosmolar'],
  ['hypoglykemi','hypoglycaemia','hypoglycemia','insulinkänning'],
  ['hyperkalemi','hyperkalaemia','hyperkalemia'],
  ['hyponatremi','hyponatraemia','hyponatremia'],
  ['binjurebarksvikt','binjurebarkssvikt','binjuresvikt','addison','addisonkris','kortisolbrist','adrenal'],
  ['dehydrering','uttorkning','dehydration','rehydrering'],
  // Toxicology, environment
  ['förgiftning','förgiftningar','intoxikation','intoxikationer','poisoning','toxicity','överdos'],
  ['kolmonoxid','koloxid','monoxide'],
  ['huggorm','ormbett','huggormsbett','snakebite'],
  ['getingstick','bistick','insektsstick','insektsallergi'],
  ['drunkning','drowning'],
  ['hypotermi','nedkylning','hypothermia'],
  ['värmeslag','hypertermi','heatstroke'],
  ['brännskada','brännskador','burn','burns'],
  // Trauma, orthopaedics, procedures
  ['mtp','masstransfusion','masstransfusionsprotokoll','transfusionsprotokoll'],
  ['kompartmentsyndrom','compartment'],
  ['fraktur','frakturer','fracture','benbrott'],
  ['ledpunktion','artrocentes','arthrocentesis'],
  ['suturering','sutur','suturera','sårskada'],
  ['sedering','procedursedering','sedation','sedera'],
  ['smärtlindring','analgesi','analgesia'],
  ['tandvärk','tand','tänder','dental','tooth','tandskada'],
  ['halta','hälta','limp'],
  // Obstetrics, gynaecology
  ['ektopisk','utomkvedshavandeskap','ectopic','extrauterin'],
  ['preeklampsi','havandeskapsförgiftning','eklampsi','preeclampsia'],
  ['missfall','miscarriage'],
  // Psychiatry, social
  ['agitation','agiterad','utagerande','agitated'],
  ['delirium','delir','förvirring','konfusion'],
  ['abstinens','withdrawal','tremens'],
  ['alkohol','etanol','alcohol'],
  ['psykos','psychosis','psykotisk'],
  ['suicid','självmord','suicidalitet','suicidförsök'],
  ['lpt','tvångsvård'],
  ['orosanmälan','socialtjänsten'],
  ['våld','misshandel','vnr'],
  ['dödsfall','avliden','dödsbevis'],
  ['palliativ','brytpunkt','vårdbegränsning','behandlingsbegränsning'],
  // Haematology
  ['transfusion','blodtransfusion','blodkomponenter','erytrocyter'],
  ['itp','trombocytopeni'],
  ['näsblödning','epistaxis'],
  ['glaukom','glaucoma','trångvinkelglaukom'],
  ['neonatal','nyfödd','nyfödda','newborn'],
  // Drugs: brand and generic names
  ['noak','doak','noac','doac','apixaban','rivaroxaban','dabigatran','edoxaban','eliquis','xarelto','pradaxa','lixiana'],
  ['warfarin','waran','vka'],
  ['antikoagulantia','antikoagulation','antikoagulationsbehandling','blodförtunnande','anticoagulant','anticoagulants','anticoagulation'],
  ['lmh','lågmolekylärt','dalteparin','enoxaparin','tinzaparin','fragmin','klexane','innohep'],
  ['stesolid','diazepam'],
  ['dormicum','midazolam','buccolam'],
  ['ketalar','ketamin','ketamine','esketamin'],
  ['actilyse','alteplas'],
  ['metalyse','tenekteplas'],
  ['cyklokapron','tranexamsyra','tranexamic','txa'],
  ['praxbind','idarucizumab'],
  ['ondexxya','andexanet'],
  ['seloken','metoprolol'],
  ['trandate','labetalol'],
  ['naloxon','nyxoid','naloxone'],
  ['hydrokortison','solucortef','hydrocortisone'],
  ['brilique','ticagrelor'],
  ['plavix','klopidogrel','clopidogrel'],
  ['trombyl','asa','acetylsalicylsyra','aspirin'],
  ['paracetamol','alvedon','panodil','acetaminophen'],
  ['acetylcystein','acetylcysteine','nac'],
  ['furosemid','furix','furosemide'],
  ['salbutamol','ventoline','airomir'],
  ['ipratropium','atrovent'],
  ['amiodaron','cordarone','amiodarone'],
  ['verapamil','isoptin'],
  ['adrenalin','epinefrin','epinephrine','emerade','epipen','jext'],
  ['noradrenalin','norepinefrin','norepinephrine'],
  ['glukagon','glucagon','glucagen'],
  ['haloperidol','haldol'],
  ['olanzapin','zyprexa'],
  ['klometiazol','heminevrin'],
  ['oxykodon','oxynorm','oxycodone'],
  ['morfin','morphine'],
 ];
 const FOLD={'å':'a','ä':'a','ö':'o','é':'e','è':'e','ë':'e','ê':'e','ü':'y'};
 function fold(s){return String(s).toLowerCase().replace(/[åäöéèëêü]/g,c=>FOLD[c]).replace(/[^a-z0-9µ]+/g,' ').trim();}
 const SYN=new Map();
 for(const g of GROUPS){
  const words=[...new Set(g.map(fold))];
  for(const a of words){const set=SYN.get(a)||new Set();for(const b of words)if(b!==a)set.add(b);SYN.set(a,set);}
 }
 function synonyms(term){return [...(SYN.get(term)||[])];}
 // Optimal string alignment distance (insert, delete, substitute, swap neighbours), stops early above max.
 function distance(a,b,max){
  if(Math.abs(a.length-b.length)>max)return max+1;
  let prev2=null,prev=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){
   const cur=[i];let low=i;
   for(let j=1;j<=b.length;j++){
    let v=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,prev2[j-2]+1);
    cur[j]=v;if(v<low)low=v;
   }
   if(low>max)return max+1;
   prev2=prev;prev=cur;
  }
  return prev[b.length];
 }
 // Closest known word to a probable typo: smallest distance, then the most frequent word.
 function closest(word,vocab,freq){
  const max=word.length>=8?2:1;let best=null,bd=max+1,bf=-1;
  for(const t of vocab){
   if(t===word||t.length<3||Math.abs(t.length-word.length)>max)continue;
   const d=distance(word,t,max);if(d>max)continue;
   const f=freq(t);if(d<bd||(d===bd&&f>bf)){best=t;bd=d;bf=f;}
  }
  return best;
 }
 root.AkTerms={fold,synonyms,distance,closest,words:()=>[...SYN.keys()]};
})(typeof globalThis!=='undefined'?globalThis:window);
