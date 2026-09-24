/* Cloudflare page views; use the same owner exclusion as guideline counts. */
(()=>{
  if(!['akutkompassen.se','www.akutkompassen.se'].includes(location.hostname))return;
  try{if(localStorage.getItem('ak.popularity.exclude')==='1')return;}catch{return;}
  const script=document.createElement('script');
  script.type='module';
  script.src='https://static.cloudflareinsights.com/beacon.min.js';
  // Opening the embedded PM reader changes history, but is not a new page view.
  script.setAttribute('data-cf-beacon',JSON.stringify({token:'31882b9fe560466f9e30c3436e188c74',spa:false}));
  document.head.appendChild(script);
})();
