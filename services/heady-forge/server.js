/* © 2026 Heady™ — HeadyForge: Template engine for creating new Heady microservices */
const http=require('http');const url=require('url');const fs=require('fs');const path=require('path');
function generateService(name,description,port,endpoints){
  const safeName=name.replace(/[^a-z0-9-]/gi,'-').toLowerCase();
  const serverJs=`/* © 2026 Heady™ Systems Inc. — ${name} */
const http=require('http');const url=require('url');
const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(parsed.pathname==='/health')return res.end(JSON.stringify({status:'ok',service:'${safeName}'}));
  ${(endpoints||[]).map(e=>`if(parsed.pathname==='${e.path}')return res.end(JSON.stringify({endpoint:'${e.path}',todo:'implement'}));`).join('\n  ')}
  res.end(JSON.stringify({service:'${name}',version:'1.0.0',description:'${description||''}'}))
});
const PORT=process.env.PORT||${port||8199};
server.listen(PORT,()=>console.log('${name} on :'+PORT));`;
  const dockerfile=`FROM node:20-slim\nWORKDIR /app\nCOPY package.json ./\nRUN npm install --production 2>/dev/null || true\nCOPY . .\nENV PORT=8080\nEXPOSE 8080\nCMD ["node","server.js"]`;
  const packageJson=JSON.stringify({name:`@heady-ai/${safeName}`,version:'1.0.0',main:'server.js',scripts:{start:'node server.js'},license:'UNLICENSED',private:true},null,2);
  return{name:safeName,files:{'server.js':serverJs,'Dockerfile':dockerfile,'package.json':packageJson}};
}
const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(parsed.pathname==='/health')return res.end(JSON.stringify({status:'ok',service:'heady-forge'}));
  if(parsed.pathname==='/generate'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const{name,description,port,endpoints}=JSON.parse(body);const result=generateService(name,description,port,endpoints);res.end(JSON.stringify(result,null,2))});return}
  res.end(JSON.stringify({service:'HeadyForge',version:'1.0.0',endpoints:{'/generate':'POST {name, description, port, endpoints}'}}))
});
const PORT=process.env.PORT||8131;server.listen(PORT,()=>console.log(`🔨 HeadyForge on :${PORT}`));
module.exports={generateService};
