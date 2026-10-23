// Deterministic, bounded ingestion. An existing interpretation is never replaced
// implicitly. All new library images are metadata-free, white-composited PNGs.
import {readFile,writeFile,mkdir,rename,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import jpeg from 'jpeg-js';
import {PNG} from 'pngjs';
import {analyzeFeatures} from '../public/feature-analysis.js';
import {validateScene} from '../public/scene.js';

const DEMO_IDS=new Set(JSON.parse(await readFile(new URL('../public/demo-assets.json',import.meta.url),'utf8')).assets.map(a=>a.id));
const MAX_BYTES=20_000_000,MAX_PIXELS=32_000_000,MAX=4096,DOWNSCALE_TO=2400;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function decode(bytes){
 if(bytes.length>MAX_BYTES)throw new Error('Image is larger than 20 MB.');
 let img;
 if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  // Dimensions are checked before inflate/allocating RGBA.
  if(bytes.length<24)throw new Error('Truncated PNG.');
  const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);
  if(!w||!h||w*h>MAX_PIXELS)throw new Error('Image exceeds 32 megapixels.');
  img={...PNG.sync.read(bytes),ext:'png'};
 }else if(bytes[0]===0xff&&bytes[1]===0xd8){
  img={...jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxResolutionInMP:32,maxMemoryUsageInMB:512}),ext:'jpg'};
  // jpeg-js preserves EXIF but does not rotate pixels. Refuse to misplace anchors.
  if(img.exifBuffer){
   const exif=Buffer.from(img.exifBuffer),offset=exif.subarray(0,6).toString('binary')==='Exif\0\0'?6:exif[0]===0?1:0;
   const t=exif.subarray(offset),little=t.subarray(0,2).toString()==='II';
   const u16=i=>little?t.readUInt16LE(i):t.readUInt16BE(i),u32=i=>little?t.readUInt32LE(i):t.readUInt32BE(i);
   try{
    if(t.length>=8&&u16(2)===42){const start=u32(4),count=u16(start);
     for(let i=0;i<count;i++){const at=start+2+i*12;
      if(u16(at)===0x112&&u16(at+2)===3&&u32(at+4)===1&&u16(at+8)!==1)
       throw new Error('Normalize this JPEG’s EXIF orientation before adding it (export as PNG from a photo editor).');
     }
    }
   }catch(error){if(error.message.includes('Normalize'))throw error;throw new Error('Invalid JPEG EXIF metadata.');}
  }
 }else throw new Error('Only PNG and JPEG images are supported.');
 if(!img.width||!img.height||img.width*img.height>MAX_PIXELS)throw new Error('Image exceeds 32 megapixels.');
 return img;
}
function canonical(img){
 const {width,height,data}=img;
 for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;for(let c=0;c<3;c++)data[i+c]=Math.round(data[i+c]*a+255*(1-a));data[i+3]=255;}
 if(width<=MAX&&height<=MAX)return img;
 const s=DOWNSCALE_TO/Math.max(width,height),W=Math.max(1,Math.round(width*s)),H=Math.max(1,Math.round(height*s)),out=Buffer.alloc(W*H*4),sum=new Float64Array(W*H*3),n=new Uint32Array(W*H);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const t=Math.min(H-1,Math.floor(y*H/height))*W+Math.min(W-1,Math.floor(x*W/width)),i=(y*width+x)*4;for(let c=0;c<3;c++)sum[t*3+c]+=data[i+c];n[t]++;}
 for(let t=0;t<W*H;t++){for(let c=0;c<3;c++)out[t*4+c]=Math.round(sum[t*3+c]/n[t]);out[t*4+3]=255;}
 return {width:W,height:H,data:out};
}
const slugify=s=>s.toLowerCase().replace(/\.[a-z0-9]+$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'image';
export async function readIndex(library){
 let text;try{text=await readFile(path.join(library,'index.local.json'),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;try{text=await readFile(path.join(library,'index.json'),'utf8');}catch(error){if(error.code==='ENOENT')return [];throw error;}}
 const index=JSON.parse(text);
 if(!Array.isArray(index)||index.length>1000)throw new Error('Invalid library index.');
 const seen=new Set();
 for(const entry of index){
  if(!entry||!/^[a-z0-9-]{1,60}$/.test(entry.id)||seen.has(entry.id)||typeof entry.title!=='string'||entry.title.length>200||
   ![`/library/${entry.id}/scene.json`,`/scenes/${entry.id}.json`].includes(entry.scene)||
   ![`/library/${entry.id}/image.png`,`/library/${entry.id}/image.jpg`,`/assets/butterfly-${entry.id}.png`].includes(entry.thumb))throw new Error('Invalid library index entry.');
  seen.add(entry.id);
 }
 return index;
}
export async function addImage(file,{id,title,library,replace=false}={}){
 library??=path.join(import.meta.dirname,'..','public','library');
 const explicitId=id!==undefined;
 id=slugify(id||path.basename(file));
 if(['orange','purple'].includes(id))throw new Error('That id is reserved for a bundled sample.');
 // Demo studies are tracked in this public repo; writing a private photo over one would stage it for publishing.
 if(DEMO_IDS.has(id))throw new Error(`That id is reserved for the public demo study ${id}. Choose a different --id.`);
 if((await stat(file)).size>MAX_BYTES)throw new Error('Image is larger than 20 MB.');
 const original=await readFile(file),inputSha=sha256(original);
 await mkdir(library,{recursive:true});
 const lock=path.join(library,'.write-lock');
 try{await mkdir(lock);}catch(e){if(e.code==='EEXIST')throw new Error('Another library operation is in progress. Retry when it finishes.');throw e;}
 try{
  const index=await readIndex(library);
  if(!explicitId&&!replace){
   for(const entry of index){
    if(!entry.scene.startsWith('/library/'))continue;
    const candidate=validateScene(JSON.parse(await readFile(path.join(library,entry.id,'scene.json'),'utf8')));
    if(candidate.analysis?.inputSha256===inputSha||candidate.analysis?.sourceSha256===inputSha){id=entry.id;break;}
   }
  }
  const existing=index.find(e=>e.id===id),dir=path.join(library,id);
  if(!existing){let present=false;try{await stat(dir);present=true;}catch(error){if(error.code!=='ENOENT')throw error;}if(present)throw new Error(`Unindexed study directory ${id} already exists. Inspect it before adding this ID; its contents were preserved.`);}
  if(existing&&!replace){
   const scene=validateScene(JSON.parse(await readFile(path.join(dir,'scene.json'),'utf8')));
   if(scene.analysis?.inputSha256===inputSha||scene.analysis?.sourceSha256===inputSha){
    const saved=await readFile(path.join(dir,path.basename(scene.image.src)));
    if(sha256(saved)!==scene.analysis.sourceSha256)throw new Error('The saved image has changed. Run npm run validate and inspect it before reuse.');
    return {id,scene,sha:scene.analysis.sourceSha256,reused:true};
   }
   throw new Error(`Study ${id} already exists. Choose a different --id, or explicitly use --replace after saving its project.`);
  }
  const img=canonical(decode(original)),bytes=PNG.sync.write({width:img.width,height:img.height,data:img.data}),sha=sha256(bytes);
  if(bytes.length>MAX_BYTES)throw new Error('Normalized PNG exceeds 20 MB. Resize the image first.');
  const src=`/library/${id}/image.png`,scene=analyzeFeatures(img.data,img.width,img.height,id,{src,width:img.width,height:img.height});
  scene.title=title||id.replace(/-/g,' ');scene.subtitle='Draft: generic roles until an agent writes its rule set';
  scene.analysis.sourceSha256=sha;scene.analysis.inputSha256=inputSha;scene.analysis.ingestionVersion='canonical-png-v1';
  validateScene(scene);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'image.png.tmp'),bytes);
  await writeFile(path.join(dir,'scene.json.tmp'),JSON.stringify(scene,null,2)+'\n');
  await rename(path.join(dir,'image.png.tmp'),path.join(dir,'image.png'));
  await rename(path.join(dir,'scene.json.tmp'),path.join(dir,'scene.json'));
  const updated=index.filter(e=>e.id!==id).concat({id,title:scene.title,scene:`/library/${id}/scene.json`,thumb:src});
  await writeFile(path.join(library,'index.local.json.tmp'),JSON.stringify(updated,null,2)+'\n');
  await rename(path.join(library,'index.local.json.tmp'),path.join(library,'index.local.json'));
  return {id,scene,sha,reused:false};
 }finally{await rm(lock,{recursive:true});}
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const args=process.argv.slice(2),options={},positionals=[];
 for(let i=0;i<args.length;i++){
  if(args[i]==='--replace')options.replace=true;
  else if(['--id','--title','--library'].includes(args[i])){const key=args[i].slice(2);if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing --${key} value.`);options[key]=args[++i];}
  else if(args[i].startsWith('--'))throw new Error(`Unknown option ${args[i]}.`);
  else positionals.push(args[i]);
 }
 if(positionals.length!==1)throw new Error('Usage: npm run add-image -- <image.png|jpg> [--id slug] [--title "Title"] [--replace]');
 const {id,scene,reused}=await addImage(positionals[0],options);
 console.log(`${reused?'Reused':'Added'} ${id}: ${scene.nodes.length} points, ${scene.networks.constellation.edges.length} constellation links. Scene: public/library/${id}/scene.json`);
 console.log(`Open the lab with ?scene=${id}`);
}
