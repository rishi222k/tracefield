import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedAssets,sha256,validatePublicFile} from '../scripts/check-public.mjs';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const bytes=Buffer.from('approved synthetic fixture');
const asset={id:'example',title:'Example',contributor:'Contributor',source:'Generated fixture',sourceName:'example.png',generator:'Reported model',modifications:'None',license:'CC0-1.0',width:10,height:10,files:[{path:'public/library/example/image.png',sha256:sha256(bytes)},{path:'public/library/example/scene.json',sha256:sha256(bytes)}]};
const manifest=assets=>({schemaVersion:1,assets});
test('public asset policy permits exact approved bytes and rejects private or altered media',()=>{
 const approved=approvedAssets(manifest([asset]));
 assert.doesNotThrow(()=>validatePublicFile(asset.files[0].path,bytes,approved));
 assert.throws(()=>validatePublicFile(asset.files[0].path,Buffer.from('changed'),approved),/Unapproved/);
 assert.throws(()=>validatePublicFile('public/library/private/image.png',bytes,approved),/Unapproved/);
 assert.throws(()=>validatePublicFile('exports/example.mp4',bytes,approved),/Unapproved/);
});

test('the history guard handles approved images above 1 MiB and catches deleted private media',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'tracefield-public-history-'));
 const git=args=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
 const script=fileURLToPath(new URL('../scripts/check-public.mjs',import.meta.url));
 try{
  git(['init','-q']);
  const image=Buffer.alloc(2*1024*1024,123),scene=Buffer.from('{}');
  const large={...asset,files:[{path:asset.files[0].path,sha256:sha256(image)},{path:asset.files[1].path,sha256:sha256(scene)}]};
  mkdirSync(path.join(dir,'public/library/example'),{recursive:true});
  writeFileSync(path.join(dir,large.files[0].path),image);
  writeFileSync(path.join(dir,large.files[1].path),scene);
  writeFileSync(path.join(dir,'public/demo-assets.json'),JSON.stringify(manifest([large])));
  git(['add','.']);
  const commit=message=>git(['-c','user.name=Fixture','-c','user.email=fixture@example.test','commit','-qm',message]);
  commit('approved large fixture');
  assert.match(execFileSync(process.execPath,[script],{cwd:dir,encoding:'utf8'}),/only 1 explicitly licensed/);
  writeFileSync(path.join(dir,'private.png'),'private fixture');
  git(['add','private.png']);commit('private fixture');
  git(['rm','private.png']);commit('remove current private fixture');
  assert.throws(()=>execFileSync(process.execPath,[script],{cwd:dir,stdio:'pipe'}),error=>error.stderr.toString().includes('Unapproved media or study: private.png'));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('public asset provenance requires licensed pairs with safe unique paths',()=>{
 assert.throws(()=>approvedAssets(manifest([asset,asset])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,license:'unknown'}])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,generator:''}])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,files:[asset.files[0]]}])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,files:[{...asset.files[0],path:'../private.png'},asset.files[1]]}])),/file/);
});
