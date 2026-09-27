/* Change DEFAULT_LOOK to 'original' to restore the original look for new visitors. */
(function(){
 'use strict';
 const DEFAULT_LOOK='kompass',KEY='ak.appearance';
 const root=document.documentElement;
 function valid(value){return value==='original'||value==='kompass';}
 function stored(){try{return localStorage.getItem(KEY);}catch{return null;}}
 function apply(value){
  root.dataset.look=valid(value)?value:DEFAULT_LOOK;
  document.querySelectorAll('[data-look-option]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lookOption===root.dataset.look)));
 }
 apply(stored());
 document.addEventListener('DOMContentLoaded',()=>{
  const top=document.querySelector('header .top');if(!top)return;
  const group=document.createElement('div');group.className='appearance-switch';group.setAttribute('role','group');group.setAttribute('aria-label','Utseende');
  const label=document.createElement('span');label.className='appearance-label';label.textContent='UTSEENDE';group.append(label);
  for(const [value,text] of [['kompass','Kompass'],['original','Original']]){
   const button=document.createElement('button');button.type='button';button.dataset.lookOption=value;button.textContent=text;
   button.addEventListener('click',()=>{apply(value);try{localStorage.setItem(KEY,value);}catch{}});group.append(button);
  }
  top.append(group);apply(root.dataset.look);
 });
 window.addEventListener('storage',event=>{if(event.key===KEY||event.key===null)apply(stored());});
})();
