/* © 2026 Heady™ — Prompt Alchemist: Transform mediocre prompts into φ-structured masterpieces */
const http=require('http');const url=require('url');const PHI=1.618033988749895;
const ENHANCEMENT_RULES=[
  {pattern:/^(.{1,30})$/,enhance:'Add context, constraints, and expected output format',priority:1},
  {pattern:/\?$/,enhance:'Transform question into structured request with examples',priority:2},
  {pattern:/help|how|what/i,enhance:'Specify desired depth, audience level, and output structure',priority:3}
];
function alchemize(prompt){
  const wordCount=prompt.split(/\s+/).length;
  const suggestions=[];
  if(wordCount<10)suggestions.push({type:'expand',reason:'Too brief — add context for φ-optimal response quality',targetWords:Math.round(wordCount*PHI)});
  if(!prompt.includes('format')&&!prompt.includes('output'))suggestions.push({type:'format',reason:'Specify desired output format (JSON, markdown, list, etc.)'});
  if(!prompt.includes('example'))suggestions.push({type:'example',reason:'Include an example of desired output'});
  if(!prompt.includes('tone')&&!prompt.includes('style'))suggestions.push({type:'tone',reason:'Specify communication style (technical, casual, academic)'});
  const score=Math.min(1,wordCount/(wordCount+PHI*10));
  return{original:prompt,suggestions,currentScore:(score*100).toFixed(0)+'%',optimalLength:Math.round(wordCount*PHI),phiCompleteness:score.toFixed(3)};
}
const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(parsed.pathname==='/health')return res.end(JSON.stringify({status:'ok',service:'prompt-alchemist'}));
  if(parsed.pathname==='/enhance'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const{prompt}=JSON.parse(body);res.end(JSON.stringify(alchemize(prompt),null,2))});return}
  res.end(JSON.stringify({service:'Prompt Alchemist',version:'1.0.0',endpoints:{'/enhance':'POST {prompt}'}}))
});
const PORT=process.env.PORT||8124;server.listen(PORT,()=>console.log(`⚗️ Prompt Alchemist on :${PORT}`));
module.exports={alchemize};
