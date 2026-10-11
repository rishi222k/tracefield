// Rebuilds the web (constellation links) of a library scene from its current
// points, using the subject-bound rule. Run after the agent edits points.
//
//   npm run net -- <id>
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {decode} from './add-image.mjs';
import {subjectConstellation} from '../public/feature-analysis.js';
import {validateScene} from '../public/scene.js';

export async function rebuildNet(id,library=path.join(import.meta.dirname,'..','public','library')){
 if(!/^[a-z0-9-]{1,60}$/.test(id||''))throw new Error('Give a library id, e.g. npm run net -- clownfish');
 const file=path.join(library,id,'scene.json'),scene=JSON.parse(await readFile(file,'utf8'));
 const img=decode(await readFile(path.join(library,id,path.basename(scene.image.src))));
 if(img.width!==scene.image.width||img.height!==scene.image.height)throw new Error('Image size does not match the scene.');
 scene.networks.constellation.edges=subjectConstellation(scene,img.data,img.width,img.height);
 validateScene(scene);
 await writeFile(file,JSON.stringify(scene,null,2)+'\n');
 return scene;
}
if(import.meta.url===`file://${process.argv[1]}`){
 const scene=await rebuildNet(process.argv[2]);
 console.log(`${process.argv[2]}: ${scene.nodes.length} points, ${scene.networks.constellation.edges.length} web links.`);
}
