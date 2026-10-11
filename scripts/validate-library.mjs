import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {validateScene} from '../public/scene.js';
import {decode,readIndex,sha256} from './add-image.mjs';
const root=path.join(import.meta.dirname,'..','public'),library=path.join(root,'library');
let failed=0;
for(const entry of await readIndex(library)){
 try{
  const scene=validateScene(JSON.parse(await readFile(path.join(root,entry.scene),'utf8')));
  if(scene.id!==entry.id)throw new Error('id does not match the index entry');
  const bytes=await readFile(path.join(root,scene.image.src)),image=decode(bytes);
  if(image.width!==scene.image.width||image.height!==scene.image.height)throw new Error('Image dimensions do not match.');
  if(scene.analysis?.sourceSha256&&scene.analysis.sourceSha256!==sha256(bytes))throw new Error('Saved source hash does not match the image.');
  if(!scene.rules?.roles.length)throw new Error('A rule set is required.');
  const roles=new Set(scene.rules.roles.map(r=>r.role));
  if(roles.size!==scene.rules.roles.length)throw new Error('Roles must be unique.');
  const bad=scene.nodes.filter(n=>!roles.has(n.label.split('.')[0])||!/^[a-z][a-z0-9-]*\.\d{2,3}$/.test(n.label));
  if(bad.length)throw new Error('Invalid role labels: '+bad.map(n=>n.label).join(', '));
  console.log(`ok ${entry.id}: ${scene.nodes.length} points, ${scene.networks.constellation.edges.length} links (${scene.analysis?.type||'authored'})`);
 }catch(e){failed++;console.error(`bad ${entry.id}: ${e.message}`);}
}
process.exitCode=failed?1:0;
