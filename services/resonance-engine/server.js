/* © 2026 Heady™ — Resonance Engine: Find harmonic connections between unrelated concepts */
const http=require('http');const url=require('url');const PHI=1.618033988749895;
function findResonance(conceptA,conceptB){
  const wordsA=new Set(conceptA.toLowerCase().split(/\W+/).filter(w=>w.length>3));
  const wordsB=new Set(conceptB.toLowerCase().split(/\W+/).filter(w=>w.length>3));
  const shared=[...wordsA].filter(w=>wordsB.has(w));
  const harmony=shared.length/Math.max(1,Math.sqrt(wordsA.size*wordsB.size));
  const phiResonance=Math.abs(harmony-1/PHI)<0.1?'golden resonance':'standard';
  return{conceptA,conceptB,sharedConcepts:shared,harmonyScore:harmony.toFixed(3),resonanceType:phiResonance,
    bridgeConcepts:shared.length>0?shared:['Consider exploring intermediate concepts'],
    musicalAnalogy:harmony>0.618?'consonant (major chord)':harmony>0.382?'interesting (suspended chord)':'dissonant (minor second)'};
}
const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(parsed.pathname==='/health')return res.end(JSON.stringify({status:'ok',service:'resonance-engine'}));
  if(parsed.pathname==='/resonate'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const{conceptA,conceptB}=JSON.parse(body);res.end(JSON.stringify(findResonance(conceptA||'',conceptB||''),null,2))});return}
  res.end(JSON.stringify({service:'Resonance Engine',version:'1.0.0',endpoints:{'/resonate':'POST {conceptA, conceptB}'}}))
});
const PORT=process.env.PORT||8127;server.listen(PORT,()=>console.log(`🎵 Resonance Engine on :${PORT}`));
module.exports={findResonance};
