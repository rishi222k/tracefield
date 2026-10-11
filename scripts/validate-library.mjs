// Validates every library scene, its image and its rule-set labels.
//   npm run validate
import {readFile,access} from 'node:fs/promises';
import {validateScene} from '../public/scene.js';
const root=new URL('../public/',import.meta.url);
const index=JSON.parse(await readFile(new URL('library/index.json',root),'utf8'));
let failed=0;
for(const entry of index){
 try{
  const scene=validateScene(JSON.parse(await readFile(new URL('.'+entry.scene,root),'utf8')));
  if(scene.id!==entry.id)throw new Error('id does not match the index entry');
  await access(new URL('.'+scene.image.src,root));
  if(scene.rules){
   const roles=new Set(scene.rules.roles.map(r=>r.role));
   const bad=scene.nodes.filter(n=>!roles.has(n.label.split('.')[0]));
   if(bad.length)throw new Error('labels without a declared role: '+bad.map(n=>n.label).join(', '));
  }
  console.log(`ok  ${entry.id}  ${scene.nodes.length} points, ${scene.networks.constellation.edges.length} web links`);
 }catch(e){failed++;console.error(`bad ${entry.id}: ${e.message}`);}
}
process.exit(failed?1:0);
