// Exact asset hashes permit reviewed demos without permitting private studies.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function approvedAssets(manifest){
 if(manifest?.schemaVersion!==1||!Array.isArray(manifest.assets)||manifest.assets.length>100)throw new Error('Invalid demo asset manifest.');
 const files=new Map(),ids=new Set();
 for(const asset of manifest.assets){
  if(!/^[a-z0-9-]{1,60}$/.test(asset.id)||ids.has(asset.id)||asset.license!=='CC0-1.0'||
   !['title','contributor','source','sourceName','generator','modifications'].every(k=>typeof asset[k]==='string'&&asset[k].length>0&&asset[k].length<=2000)||
   ![asset.width,asset.height].every(n=>Number.isInteger(n)&&n>=1&&n<=4096)||!Array.isArray(asset.files)||asset.files.length!==2)throw new Error('Incomplete or unsafe demo provenance.');
  ids.add(asset.id);
  const expected=new Set([`public/library/${asset.id}/image.png`,`public/library/${asset.id}/scene.json`]);
  for(const file of asset.files){
   if(!expected.delete(file.path)||files.has(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256))throw new Error('Invalid demo file or hash.');
   files.set(file.path,file.sha256);
  }
 }
 return files;
}
export function needsApproval(file){
 return /(^|\/)(references|results|exports)\//.test(file)||/\.(png|jpe?g|webp|avif|gif|mp4|webm|mov)$/i.test(file)||
  (/^public\/library\//.test(file)&&!['public/library/index.json','public/library/.gitkeep'].includes(file));
}
export function validatePublicFile(file,bytes,approved){
 if(needsApproval(file)&&(!approved.has(file)||sha256(bytes)!==approved.get(file)))throw new Error(`Unapproved media or study: ${file}`);
}
export function checkPublic(){
 const approved=approvedAssets(JSON.parse(readFileSync('public/demo-assets.json','utf8')));
 const git=args=>execFileSync('git',args,{encoding:'utf8'});
 const tracked=git(['ls-files','--cached']).split('\n').filter(Boolean);
 for(const [file,hash]of approved){
  if(!tracked.includes(file)||sha256(readFileSync(file))!==hash)throw new Error(`Approved demo is missing, untracked or changed: ${file}`);
 }
 for(const file of tracked)if(needsApproval(file))validatePublicFile(file,readFileSync(file),approved);
 for(const line of git(['rev-list','--objects','--all']).split('\n')){
  const oid=line.slice(0,40),file=line.slice(41);
  if(file&&needsApproval(file)&&git(['cat-file','-t',oid]).trim()==='blob')validatePublicFile(file,execFileSync('git',['cat-file','blob',oid]),approved);
 }
 console.log(`Public history contains only ${approved.size/2} explicitly licensed demo studies; no unapproved media or exports.`);
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)checkPublic();
