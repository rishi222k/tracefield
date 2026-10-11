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
 const index=JSON.parse(await readFile(path.join(dir,'a','index.json'),'utf8'));
 assert.deepEqual(index,[{id:'test-photo',title:'Test',scene:'/library/test-photo/scene.json',thumb:'/library/test-photo/image.png'}]);
 await addImage(file,{library:path.join(dir,'a'),title:'Again'});
 assert.equal(JSON.parse(await readFile(path.join(dir,'a','index.json'),'utf8')).length,1,'re-adding replaces the entry');
 await assert.rejects(addImage(file,{library:path.join(dir,'c'),id:'orange'}),/reserved/);
});

test('library scenes can only use their own library image',async()=>{
 for(const entry of JSON.parse(await readFile(new URL('../public/library/index.json',import.meta.url),'utf8'))){
  const scene=validateScene(JSON.parse(await readFile(new URL('../public'+entry.scene,import.meta.url),'utf8')));
  assert.equal(scene.id,entry.id);
  if(entry.scene.startsWith('/library/')){const other=structuredClone(scene);other.id='someone-else';assert.throws(()=>validateScene(other),/own image/);}
 }
});
