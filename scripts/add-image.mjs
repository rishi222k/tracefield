// Adds an image to the lab library: copies it in, writes a deterministic draft
// scene (feature-proposal-v3) and lists it in the library index. The agent then
// replaces the draft's generic roles with its own rule set (docs/decision-contract.md).
//
//   npm run add-image -- <image.png|jpg> [--id slug] [--title "Title"] [--library dir]
//
// Decoding uses pure-JS decoders, not a browser, so the same file gives the same
// draft on every machine.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import jpeg from 'jpeg-js';
import {PNG} from 'pngjs';
import {analyzeFeatures} from '../public/feature-analysis.js';
import {validateScene} from '../public/scene.js';

const MAX=4096,DOWNSCALE_TO=2400;

export function decode(bytes){
 if(bytes[0]===0x89&&bytes[1]===0x50)return {...PNG.sync.read(bytes),ext:'png'};
 if(bytes[0]===0xff&&bytes[1]===0xd8){const img=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxMemoryUsageInMB:1024});return {width:img.width,height:img.height,data:img.data,ext:'jpg'};}
 throw new Error('Only PNG and JPEG images are supported.');
}
// Area-average downscale for images beyond the lab's 4096 px limit.
function shrink({width,height,data}){
 const s=DOWNSCALE_TO/Math.max(width,height),W=Math.round(width*s),H=Math.round(height*s),out=new Uint8Array(W*H*4),sum=new Float64Array(W*H*4),n=new Float64Array(W*H);
 for(let y=0;y<height;y++){const ty=Math.min(H-1,Math.floor(y*H/height));for(let x=0;x<width;x++){const t=ty*W+Math.min(W-1,Math.floor(x*W/width)),i=(y*width+x)*4;for(let c=0;c<4;c++)sum[t*4+c]+=data[i+c];n[t]++;}}
 for(let t=0;t<W*H;t++)for(let c=0;c<4;c++)out[t*4+c]=Math.round(sum[t*4+c]/n[t]);
 return {width:W,height:H,data:out};
}
const slugify=s=>s.toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'image';

export async function addImage(file,{id,title,library}={}){
 library??=path.join(import.meta.dirname,'..','public','library');
 id=slugify(id||path.basename(file));
 if(['orange','purple'].includes(id))throw new Error('That id is reserved for a bundled sample.');
 let bytes=await readFile(file),img=decode(bytes);
 if(img.width>MAX||img.height>MAX){img=shrink(img);bytes=jpeg.encode({data:img.data,width:img.width,height:img.height},90).data;img={...img,ext:'jpg'};}
 const src=`/library/${id}/image.${img.ext}`,sha=createHash('sha256').update(bytes).digest('hex');
 const scene=analyzeFeatures(img.data,img.width,img.height,id,{src,width:img.width,height:img.height});
 scene.title=title||id.replace(/-/g,' ');scene.subtitle='Draft: generic roles until an agent writes its rule set';
 scene.analysis.sourceSha256=sha;
 validateScene(scene);
 await mkdir(path.join(library,id),{recursive:true});
 await writeFile(path.join(library,id,'image.'+img.ext),bytes);
 await writeFile(path.join(library,id,'scene.json'),JSON.stringify(scene,null,2)+'\n');
 const indexFile=path.join(library,'index.json');
 let index=[];try{index=JSON.parse(await readFile(indexFile,'utf8'));}catch{}
 index=index.filter(e=>e.id!==id).concat({id,title:scene.title,scene:`/library/${id}/scene.json`,thumb:src});
 await writeFile(indexFile,JSON.stringify(index,null,2)+'\n');
 return {id,scene,sha};
}

if(import.meta.url===`file://${process.argv[1]}`){
 const args=process.argv.slice(2),file=args.find(a=>!a.startsWith('--')&&!['--id','--title','--library'].includes(args[args.indexOf(a)-1]));
 const opt=k=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:undefined;};
 if(!file){console.error('Usage: npm run add-image -- <image.png|jpg> [--id slug] [--title "Title"]');process.exit(1);}
 const {id,scene}=await addImage(file,{id:opt('id'),title:opt('title'),library:opt('library')});
 console.log(`Added ${id}: ${scene.nodes.length} points, ${scene.networks.constellation.edges.length} constellation links. Draft scene: public/library/${id}/scene.json`);
}
