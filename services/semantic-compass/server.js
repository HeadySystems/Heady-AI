/* © 2026 Heady™ — Semantic Compass: Navigate your knowledge space directionally */
const http=require('http');const url=require('url');const PHI=1.618033988749895;const TAU=Math.PI*2;
function navigate(currentTopic,direction,knowledgeBase){
  const directions={north:'broader/abstract',south:'specific/detailed',east:'related/adjacent',west:'contrasting/opposite',northeast:'abstract+adjacent',northwest:'abstract+contrasting',southeast:'specific+adjacent',southwest:'specific+contrasting'};
  const angle={north:0,northeast:TAU/8,east:TAU/4,southeast:3*TAU/8,south:TAU/2,southwest:5*TAU/8,west:3*TAU/4,northwest:7*TAU/8};
  const dirAngle=angle[direction]||0;
  const suggestions=(knowledgeBase||[]).map((item,i)=>{
    const itemAngle=(i/(knowledgeBase||[]).length)*TAU;
    const distance=Math.abs(itemAngle-dirAngle);
    return{...item,relevance:(1-distance/Math.PI).toFixed(3),directionMatch:distance<TAU/4};
  }).filter(i=>i.directionMatch).sort((a,b)=>b.relevance-a.relevance).slice(0,5);
  return{from:currentTopic,direction,meaning:directions[direction]||'explore',suggestions,compassAngle:dirAngle.toFixed(2)};
}
const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(parsed.pathname==='/health')return res.end(JSON.stringify({status:'ok',service:'semantic-compass'}));
  if(parsed.pathname==='/navigate'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const{topic,direction,knowledgeBase}=JSON.parse(body);res.end(JSON.stringify(navigate(topic,direction,knowledgeBase),null,2))});return}
  if(parsed.pathname==='/directions')return res.end(JSON.stringify({north:'broader',south:'specific',east:'related',west:'contrasting',northeast:'abstract+adjacent',northwest:'abstract+contrasting',southeast:'specific+adjacent',southwest:'specific+contrasting'}));
  res.end(JSON.stringify({service:'Semantic Compass',version:'1.0.0',endpoints:{'/navigate':'POST','/directions':'GET'}}))
});
const PORT=process.env.PORT||8126;server.listen(PORT,()=>console.log(`🧭 Semantic Compass on :${PORT}`));
module.exports={navigate};
