import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {PNG} from 'pngjs';
import {addImage} from '../scripts/add-image.mjs';
import {validateScene} from '../public/scene.js';

const fixture=async dir=>{
 const png=new PNG({width:240,height:180});
 for(let y=0;y<180;y++)for(let x=0;x<240;x++){const i=(y*240+x)*4,inside=(x-120)**2+(y-90)**2<60**2,mark=(x-105)**2+(y-80)**2<36;png.data.set(mark?[250,250,250,255]:inside?[230,110,30,255]:[120,128,130,255],i);}
 const file=path.join(dir,'Test Photo.png');await writeFile(file,PNG.sync.write(png));return file;
};

test('add-image writes a deterministic, valid library entry',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'nna-')),file=await fixture(dir);
 const a=await addImage(file,{library:path.join(dir,'a'),title:'Test'}),b=await addImage(file,{library:path.join(dir,'b'),title:'Test'});
 assert.equal(a.id,'test-photo');
 const sa=await readFile(path.join(dir,'a','test-photo','scene.json'),'utf8'),sb=await readFile(path.join(dir,'b','test-photo','scene.json'),'utf8');
 assert.equal(sa,sb,'same image gives the same scene');
 const scene=validateScene(JSON.parse(sa));
 assert.equal(scene.image.src,'/library/test-photo/image.png');assert.equal(scene.analysis.sourceSha256,a.sha);
 const index=JSON.parse(await readFile(path.join(dir,'a','index.local.json'),'utf8'));
 assert.deepEqual(index,[{id:'test-photo',title:'Test',scene:'/library/test-photo/scene.json',thumb:'/library/test-photo/image.png'}]);
 const accepted=JSON.parse(sa);accepted.subtitle='Accepted scene';await writeFile(path.join(dir,'a','test-photo','scene.json'),JSON.stringify(accepted));
 const reuse=await addImage(file,{library:path.join(dir,'a'),title:'Again'});
 assert.equal(reuse.reused,true);assert.equal(reuse.scene.subtitle,'Accepted scene');
 assert.equal(JSON.parse(await readFile(path.join(dir,'a','index.local.json'),'utf8')).length,1,'re-adding replaces the entry');
 await assert.rejects(addImage(file,{library:path.join(dir,'c'),id:'orange'}),/reserved/);
});

test('library scenes can only use their own library image',async()=>{
 for(const entry of JSON.parse(await readFile(new URL('../public/library/index.json',import.meta.url),'utf8'))){
  const scene=validateScene(JSON.parse(await readFile(new URL('../public'+entry.scene,import.meta.url),'utf8')));
  assert.equal(scene.id,entry.id);
  if(entry.scene.startsWith('/library/')){const other=structuredClone(scene);other.id='someone-else';assert.throws(()=>validateScene(other),/own image/);}
 }
});

test('same-name different images and malformed indexes cannot destroy saved decisions',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'tracefield-conflict-')),file=await fixture(dir),library=path.join(dir,'library');
 await addImage(file,{library,id:'study'});
 const before=await readFile(path.join(library,'study','scene.json'),'utf8');
 const pixels=new PNG({width:2,height:2});pixels.data.fill(255);const other=path.join(dir,'other.png');await writeFile(other,PNG.sync.write(pixels));
 await assert.rejects(addImage(other,{library,id:'study'}),/already exists/);
 assert.equal(await readFile(path.join(library,'study','scene.json'),'utf8'),before);
 await writeFile(path.join(library,'index.local.json'),'{broken');
 await assert.rejects(addImage(other,{library,id:'another'}),/JSON/);
 assert.equal(await readFile(path.join(library,'study','scene.json'),'utf8'),before);
});

test('ingestion strips metadata and white-composites transparency deterministically',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'tracefield-alpha-')),png=new PNG({width:2,height:1});
 png.data.set([0,0,0,0,200,0,0,128]);const file=path.join(dir,'alpha.png');await writeFile(file,PNG.sync.write(png));
 const {decode}=await import('../scripts/add-image.mjs');
 const {scene}=await addImage(file,{library:path.join(dir,'library')});
 const bytes=await readFile(path.join(dir,'library','alpha','image.png')),decoded=decode(bytes);
 assert.deepEqual([...decoded.data],[255,255,255,255,227,127,127,255]);
 assert.equal(scene.analysis.ingestionVersion,'canonical-png-v1');
 const bomb=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(bomb);bomb.writeUInt32BE(100000,16);bomb.writeUInt32BE(100000,20);
 assert.throws(()=>decode(bomb),/32 megapixels/);
 assert.throws(()=>decode(Buffer.alloc(20_000_001)),/20 MB/);
});

test('EXIF-rotated JPEGs are rejected rather than silently misplacing anchors',async()=>{
 const jpeg=(await import('jpeg-js')).default,{decode}=await import('../scripts/add-image.mjs');
 const tiff=Buffer.alloc(26);tiff.write('II',0);tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);tiff.writeUInt16LE(1,8);tiff.writeUInt16LE(0x112,10);tiff.writeUInt16LE(3,12);tiff.writeUInt32LE(1,14);tiff.writeUInt16LE(6,18);
 const exifBuffer=Buffer.concat([Buffer.from('Exif\0\0'),tiff]);
 const image={width:2,height:1,data:Buffer.from([0,0,0,255,255,255,255,255]),exifBuffer};
 assert.throws(()=>decode(jpeg.encode(image,90).data),/Normalize/);
 tiff.writeUInt16LE(1,18);image.exifBuffer=Buffer.concat([Buffer.from('Exif\0\0'),tiff]);
 assert.equal(decode(jpeg.encode(image,90).data).width,2);
});

test('a renamed input reuses its authored scene and corrupted source files fail explicitly',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'tracefield-content-')),file=await fixture(dir),library=path.join(dir,'library');
 const first=await addImage(file,{library});
 const scenePath=path.join(library,first.id,'scene.json'),scene=JSON.parse(await readFile(scenePath,'utf8'));scene.subtitle='Authored scene';await writeFile(scenePath,JSON.stringify(scene));
 const renamed=path.join(dir,'renamed.png');await writeFile(renamed,await readFile(file));
 const second=await addImage(renamed,{library});assert.equal(second.id,first.id);assert.equal(second.reused,true);assert.equal(second.scene.subtitle,'Authored scene');
 await writeFile(path.join(library,first.id,'image.png'),'corrupted');
 await assert.rejects(addImage(renamed,{library}),/saved image has changed/);
 assert.equal(JSON.parse(await readFile(scenePath,'utf8')).subtitle,'Authored scene');
});
