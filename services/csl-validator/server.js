/* © 2026 Heady™ — CSL Validator: Validate Continuous Semantic Logic gate outputs */
const http=require('http');const url=require('url');const PHI=1.618033988749895;
const GATES={alpha:{threshold:1/PHI,name:'Quality Gate α',checks:['coherence','relevance','accuracy']},
beta:{threshold:Math.pow(1/PHI,2),name:'Quality Gate β',checks:['depth','novelty','completeness']},
gamma:{threshold:Math.pow(1/PHI,3),name:'Final Gate γ',checks:['safety','alignment','quality']}};
function validateGate(gateName,scores){
  const gate=GATES[gateName]||GATES.alpha;
  const checks=gate.checks.map(c=>{const score=scores?.[c]||0.5;return{check:c,score,pass:score>=gate.threshold,threshold:gate.threshold.toFixed(3)}});
  const passed=checks.filter(c=>c.pass).length;
  return{gate:gate.name,checks,passed,total:checks.length,overallPass:passed===checks.length,
    phiThreshold:gate.threshold.toFixed(3),confidence:(passed/checks.length).toFixed(3)};
}
const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(parsed.pathname==='/health')return res.end(JSON.stringify({status:'ok',service:'csl-validator'}));
  if(parsed.pathname==='/gates')return res.end(JSON.stringify(GATES,null,2));
  if(parsed.pathname==='/validate'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const{gate,scores}=JSON.parse(body);res.end(JSON.stringify(validateGate(gate||'alpha',scores||{}),null,2))});return}
  res.end(JSON.stringify({service:'CSL Validator',version:'1.0.0',endpoints:{'/validate':'POST {gate, scores}','/gates':'GET'}}))
});
const PORT=process.env.PORT||8128;server.listen(PORT,()=>console.log(`🔒 CSL Validator on :${PORT}`));
module.exports={validateGate,GATES};
