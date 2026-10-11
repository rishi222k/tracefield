import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedAssets,sha256,validatePublicFile} from '../scripts/check-public.mjs';
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
test('public asset provenance requires licensed pairs with safe unique paths',()=>{
 assert.throws(()=>approvedAssets(manifest([asset,asset])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,license:'unknown'}])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,generator:''}])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,files:[asset.files[0]]}])),/provenance/);
 assert.throws(()=>approvedAssets(manifest([{...asset,files:[{...asset.files[0],path:'../private.png'},asset.files[1]]}])),/file/);
});
