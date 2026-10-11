import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures.mjs';
import {transformPixels,EFFECT_VERSION} from '../public/image-effects.js';
import {analyzePixels,ANALYSIS_VERSION} from '../public/image-analysis.js';
import {validateScene,defaults,visibleGraph} from '../public/scene.js';
import {normalizeSettings,RENDERER_VERSION,overlayColors} from '../public/settings.js';
import {validateProject} from '../public/project.js';
const pixels=values=>new Uint8ClampedArray(values.flatMap(v=>[v,v,v,255]));
const orange=fixture();
const bundle=()=>({version:2,rendererVersion:RENDERER_VERSION,effectVersion:EFFECT_VERSION,scene:structuredClone(orange),settings:{...defaults},time:5.5});

test('negative inverts endpoints and preserves neutral gray with controlled contrast',()=>{
 const src=pixels([0,127,128,255]),copy=src.slice();
 const out=transformPixels(src,4,1,85,'xray');
 assert.deepEqual([...out.filter((_,i)=>i%4===0)],[255,129,126,0]);
 assert.deepEqual(src,copy);assert.deepEqual(out,transformPixels(src,4,1,85,'xray'));
 assert.equal(transformPixels(new Uint8ClampedArray([0,0,0,0]),1,1,100,'xray')[0],0,'transparency composites against white');
});
test('restored first dark treatment suppresses flat background and reveals local contrast',()=>{
 const src=pixels(Array(81).fill(128));src.set([255,255,255,255],(4*9+4)*4);src.set([0,0,0,255],(4*9+5)*4);
 const before=src.slice(),out=transformPixels(src,9,9,85,'darkfield');
 assert.equal(out[0],0);assert.ok(out[(4*9+4)*4]>240);assert.ok(out[(4*9+5)*4]>240);
 assert.deepEqual(src,before);assert.deepEqual(out,transformPixels(src,9,9,85,'darkfield'));
 assert.ok(transformPixels(pixels(Array(81).fill(128)),9,9,85,'darkfield').every((v,i)=>i%4===3?v===255:v===0));
 assert.throws(()=>transformPixels(src,9,9,NaN,'xray'));assert.throws(()=>transformPixels(src,8,9,85,'xray'));
});
test('feature proposal is stable, normalized, explicit about meaning and separate from dials',()=>{
 const src=pixels(Array.from({length:128*96},(_,i)=>((i%128>>3)+(i/128>>3))%2?240:24));
 const image={src:'data:image/png;base64,AA==',width:128,height:96};
 const before=src.slice(),a=validateScene(analyzePixels(src,128,96,'upload-fixture',image));
 assert.deepEqual(a,analyzePixels(src,128,96,'upload-fixture',image));assert.deepEqual(src,before);
 assert.equal(a.analysis.version,ANALYSIS_VERSION);assert.equal(a.analysis.type,'local-feature-proposal');
 assert.ok(a.nodes.some(n=>n.kind==='observation'));assert.ok(a.nodes.every(n=>n.x>=0&&n.x<=1&&n.y>=0&&n.y<=1));
 assert.ok(a.nodes.filter(n=>n.kind==='observation').every(n=>n.reason.includes('no semantic')));
 const snapshot=JSON.stringify(a);visibleGraph(a,{...defaults,network:'pattern',seed:9999,range:30});assert.equal(JSON.stringify(a),snapshot);
});
test('uniform and tiny images get honest compositional fallback',()=>{
 for(const size of [1,16,64]){
  const scene=validateScene(analyzePixels(pixels(Array(size*size).fill(128)),size,size,'upload-blank',{src:'data:image/png;base64,AA==',width:size,height:size}));
  assert.equal(scene.nodes.filter(n=>n.kind==='observation').length,0);assert.equal(scene.networks.pattern.edges.length,0);
  assert.match(scene.networks.structure.meaning,/No strong/);
 }
});
test('project round trip retains image, decisions, settings and frame without mutation',()=>{
 const original=bundle();original.settings.imageStyle='darkfield';original.settings.labelMotion='float';
 const restored=validateProject(JSON.parse(JSON.stringify(original)));
 assert.deepEqual(restored.scene,original.scene);assert.deepEqual(restored.settings,original.settings);assert.equal(restored.time,5.5);
 restored.scene.nodes[0].x=0;assert.notEqual(restored.scene.nodes[0].x,original.scene.nodes[0].x);
 assert.equal(validateProject({version:1,sceneId:'purple',settings:defaults,time:2}).sceneId,'purple');
});
test('unsafe, oversized, incompatible and malformed projects fail before rendering',()=>{
 for(const mutate of [b=>b.scene.image.src='https://example.com/private.png',b=>b.scene.image.src='data:image/svg+xml;base64,AA==',b=>b.scene.image.width=4097,b=>b.scene.nodes[0].labelOffset=[Infinity,0],b=>b.scene.nodes=Array(251).fill(b.scene.nodes[0]),b=>b.rendererVersion='future',b=>b.effectVersion='future',b=>b.time=12,b=>b.time=-1,b=>b.time=NaN,b=>b.settings.seed=1.5,b=>b.settings.maxLinks=1.5,b=>b.settings.opacity=Infinity,b=>b.settings.imageStyle='secret',b=>b.settings.accent='red']){
  const data=bundle();mutate(data);assert.throws(()=>validateProject(data));
 }
 assert.throws(()=>normalizeSettings({...defaults,noteTravel:999}));
 const next=normalizeSettings({...defaults,unexpected:'ignored'});assert.equal(next.unexpected,undefined);
});

test('overlay palettes adapt independently from the image and remain user-controllable',()=>{
 assert.deepEqual(overlayColors({...defaults,imageStyle:'xray'}),{primary:'#142726',accent:'#79512e'});
 assert.deepEqual(overlayColors({...defaults,imageStyle:'darkfield'}),{primary:'#edf3ec',accent:'#e5bc86'});
 assert.equal(overlayColors({...defaults,imageStyle:'xray',adaptiveOverlay:false}).primary,defaults.primary);
});


test('surface layer retains broad colored petals without changing the first dark or light treatment',()=>{
 const src=pixels(Array(21*21).fill(128));
 // Orange has almost the same luminance as the gray field, so detail-only
 // processing loses its broad interior. This checks that exact failure mode.
 for(let y=5;y<16;y++)for(let x=5;x<16;x++)src.set([255,88,0,255],(y*21+x)*4);
 const before=src.slice(),center=(10*21+10)*4;
 const first=transformPixels(src,21,21,85,'darkfield',0);
 const surface=transformPixels(src,21,21,85,'darkfield',55);
 assert.equal(first[center],0);assert.ok(surface[center]>50);
 assert.equal(surface[0],0,'neutral field remains black');
 assert.deepEqual(first,transformPixels(src,21,21,85,'darkfield'));
 assert.deepEqual(surface,transformPixels(src,21,21,85,'darkfield',55));
 assert.deepEqual(transformPixels(src,21,21,85,'xray',0),transformPixels(src,21,21,85,'xray',100));
 assert.deepEqual(src,before);
 assert.throws(()=>transformPixels(src,21,21,85,'darkfield',101));
});

test('original version-2 projects preserve their renderer and paused frame',()=>{
 const original=bundle();original.rendererVersion='node-network-renderer-v2';original.time=5.5;
 const restored=validateProject(original);assert.equal(restored.rendererVersion,'node-network-renderer-v2');assert.equal(restored.time,5.5);
});

test('embedded PNG dimensions are checked before browser decoding',()=>{
 const header=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(header);header.writeUInt32BE(13,8);header.write('IHDR',12);header.writeUInt32BE(90000,16);header.writeUInt32BE(90000,20);
 const p=bundle();p.scene.image.src='data:image/png;base64,'+header.toString('base64');
 assert.throws(()=>validateProject(p),/bounded scene/);
 header.writeUInt32BE(p.scene.image.width,16);header.writeUInt32BE(p.scene.image.height,20);p.scene.image.src='data:image/png;base64,'+header.toString('base64');
 assert.equal(validateProject(p).scene.image.width,p.scene.image.width,'bounded header passes; browser still validates the full PNG');
 p.scene.image.src='data:image/png;base64,AA==';assert.throws(()=>validateProject(p),/header/);
});
