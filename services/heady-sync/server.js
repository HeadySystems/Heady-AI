/* © 2026 Heady™ — HeadySync: Cross-device state synchronization */
const http=require('http');const url=require('url');const fs=require('fs');const path=require('path');
const STORE_PATH=path.join(__dirname,'../../.heady_cache/sync-store.json');
function loadStore(){try{return JSON.parse(fs.readFileSync(STORE_PATH,'utf8'))}catch{return{devices:[],syncLog:[],version:1}}}
function saveStore(s){const d=path.dirname(STORE_PATH);if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});fs.writeFileSync(STORE_PATH,JSON.stringify(s,null,2))}
function sync(deviceId,state){
  const store=loadStore();let device=store.devices.find(d=>d.id===deviceId);
  if(!device){device={id:deviceId,registered:new Date().toISOString()};store.devices.push(device)}
  device.lastSync=new Date().toISOString();device.state=state;
  store.syncLog.push({deviceId,timestamp:device.lastSync,stateKeys:Object.keys(state||{})});
  if(store.syncLog.length>100)store.syncLog=store.syncLog.slice(-50);
  store.version++;saveStore(store);
  return{synced:device,connectedDevices:store.devices.length};
}
const server=http.createServer((req,res)=>{
  const parsed=url.parse(req.url,true);
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
  if(parsed.pathname==='/health')return res.end(JSON.stringify({status:'ok',service:'heady-sync'}));
  if(parsed.pathname==='/sync'&&req.method==='POST'){let body='';req.on('data',c=>body+=c);req.on('end',()=>{const{deviceId,state}=JSON.parse(body);res.end(JSON.stringify(sync(deviceId,state)))});return}
  if(parsed.pathname==='/devices')return res.end(JSON.stringify(loadStore()));
  res.end(JSON.stringify({service:'HeadySync',version:'1.0.0',endpoints:{'/sync':'POST {deviceId, state}','/devices':'GET'}}))
});
const PORT=process.env.PORT||8129;server.listen(PORT,()=>console.log(`🔄 HeadySync on :${PORT}`));
module.exports={sync};
