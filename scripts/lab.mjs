// Launch or reuse only a loopback server belonging to this exact checkout.
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {open,writeFile,readFile} from 'node:fs/promises';
import {realpathSync} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
const root=realpathSync(path.join(import.meta.dirname,'..')),rootId=createHash('sha256').update(root).digest('hex').slice(0,24);
const args=process.argv.slice(2);let scene;
if(args.length){if(args.length!==2||args[0]!=='--scene'||!/^[a-z0-9-]{1,60}$/.test(args[1]))throw new Error('Usage: npm run lab -- [--scene id]');scene=args[1];}
const alive=async port=>{try{const r=await fetch(`http://127.0.0.1:${port}/__tracefield`,{signal:AbortSignal.timeout(600)}),health=await r.json();return r.ok&&health.app==='tracefield'&&health.rootId===rootId;}catch{return false;}};
const free=port=>new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});
const state=path.join(root,'.tracefield-server.json');
let recorded;try{recorded=JSON.parse(await readFile(state,'utf8'));}catch{}
let port;
if(Number.isInteger(recorded?.port)&&recorded.port>=4318&&recorded.port<=4418&&await alive(recorded.port))port=recorded.port;
for(let candidate=4318;port===undefined&&candidate<=4418;candidate++){
 if(await alive(candidate)){port=candidate;break;}
 if(!await free(candidate))continue;
 const log=await open(path.join(root,'.tracefield-server.log'),'a');
 const child=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(candidate),'--strictPort'],{cwd:root,detached:true,stdio:['ignore',log.fd,log.fd]});
 let failure;child.once('error',error=>{failure=error;});child.unref();await log.close();
 for(let retry=0;retry<80;retry++){
  if(await alive(candidate)){port=candidate;await writeFile(state,JSON.stringify({port,pid:child.pid,rootId})+'\n');break;}
  if(failure)throw failure;
  if(child.exitCode!==null)break;
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 if(port===undefined&&child.exitCode===null){
  // Only this just-created process is stopped; other apps are never touched.
  child.kill('SIGTERM');throw new Error('Tracefield failed to start. See .tracefield-server.log.');
 }
}
if(port===undefined)throw new Error('No free loopback port in 4318–4418.');
console.log(JSON.stringify({url:`http://127.0.0.1:${port}/${scene?'?scene='+scene:''}`,port,rootId}));
