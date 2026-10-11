import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures.mjs';
import {analyzeFeatures,FEATURE_ANALYSIS_VERSION} from '../public/feature-analysis.js';
import {visibleGraph,growth,selection,segmentsCross,space,spanningTree,persistence,edgeKey} from '../public/graph.js';
import {validateScene,defaults} from '../public/scene.js';
import {validateProject} from '../public/project.js';
import {RENDERER_VERSION} from '../public/settings.js';
import {EFFECT_VERSION} from '../public/image-effects.js';

const image=(W,H,paint)=>{const px=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++)px.set(paint(x,y),(y*W+x)*4);return px;};
const meta=(W,H)=>({src:'data:image/png;base64,AA==',width:W,height:H});
const SPOTS=[[60,50,240],[150,100,20],[240,60,240],[90,150,20],[220,160,240]];
const spots=image(300,200,(x,y)=>{let v=128;for(const [sx,sy,c] of SPOTS)if((x-sx)**2+(y-sy)**2<=36)v=c;return [v,v,v,255];});
const samples=[fixture('fixture-a'),fixture('fixture-b')];
const crossings=scene=>{const s=space(scene.image),map=new Map(scene.nodes.map(n=>[n.id,{x:n.x*s.sx,y:n.y*s.sy}]));return key=>{const E=scene.networks[key].edges;let c=0;for(let i=0;i<E.length;i++)for(let j=i+1;j<E.length;j++){const e=E[i],f=E[j];if([e.a,e.b].some(v=>v===f.a||v===f.b))continue;if(segmentsCross(map.get(e.a),map.get(e.b),map.get(f.a),map.get(f.b)))c++;}return c;};};

test('feature proposal v2 finds measured spots at their centres with honest labels',()=>{
 const before=spots.slice(),scene=validateScene(analyzeFeatures(spots,300,200,'upload-spots',meta(300,200)));
 assert.deepEqual(spots,before,'pixels are not mutated');
 assert.deepEqual(scene,analyzeFeatures(spots,300,200,'upload-spots',meta(300,200)),'deterministic');
 assert.equal(scene.analysis.version,FEATURE_ANALYSIS_VERSION);assert.equal(scene.analysis.type,'local-feature-proposal');
 const found=scene.nodes.filter(n=>n.kind==='observation');
 for(const [sx,sy,c] of SPOTS){
  const hit=found.find(n=>Math.hypot(n.x*300-sx,n.y*200-sy)<=2);
  assert.ok(hit,`spot at ${sx},${sy} is found within 2 px`);
  assert.equal(hit.feature.type,'spot');assert.equal(hit.feature.tone,c>128?'light':'dark');
  assert.match(hit.label,/^mark\.\d\d$/);
 }
 for(const n of found){assert.match(n.reason,/no semantic object identity/);assert.ok(n.score>=0&&n.score<=1);}
 const roles=new Set(scene.rules.roles.map(r=>r.role));
 for(const n of scene.nodes)assert.ok(roles.has(n.label.split('.')[0])&&/^[a-z]+\.\d\d$/.test(n.label),'every label is a declared role: '+n.label);
 assert.equal(new Set(scene.focus).size,scene.focus.length);
 const bad=structuredClone(scene);bad.rules.roles[0].role='Not A Role';assert.throws(()=>validateScene(bad),/rule set/);
 for(const n of scene.nodes.filter(n=>n.kind==='composition'))assert.match(n.reason,/not an image feature/);
});

test('v2 networks are crossing-free, weighted and keep a connected backbone',()=>{
 const disc=image(240,180,(x,y)=>{const inside=(x-120)**2+(y-90)**2<70**2,mark=((x-100)**2+(y-80)**2<30)||((x-140)**2+(y-100)**2<30)||((x-125)**2+(y-60)**2<30);return mark?[250,250,250,255]:inside?[220,110,30,255]:[128,128,128,255];});
 for(const scene of [analyzeFeatures(spots,300,200,'upload-a',meta(300,200)),analyzeFeatures(disc,240,180,'upload-b',meta(240,180))]){
  validateScene(scene);const cross=crossings(scene);
  for(const key of ['constellation','structure','pattern']){
   assert.equal(cross(key),0,key+' has no crossing links');
   for(const e of scene.networks[key].edges){assert.ok(e.weight>=0&&e.weight<=1);assert.ok(e.reason.length>10);}
  }
  const parent=new Map(scene.nodes.map(n=>[n.id,n.id])),find=v=>parent.get(v)===v?v:find(parent.get(v));
  for(const e of scene.networks.constellation.edges)parent.set(find(e.a),find(e.b));
  assert.equal(new Set(scene.nodes.map(n=>find(n.id))).size,1,'constellation joins every anchor');
 }
});

test('uniform and tiny images get negative-space anchors only',()=>{
 for(const size of [1,16,64]){
  const scene=validateScene(analyzeFeatures(image(size,size,()=>[128,128,128,255]),size,size,'upload-blank',meta(size,size)));
  assert.equal(scene.nodes.filter(n=>n.kind==='observation').length,0);
  assert.equal(scene.networks.structure.edges.length,0);assert.equal(scene.networks.pattern.edges.length,0);
  assert.match(scene.networks.structure.meaning,/No strong/);
 }
});

test('geometry: spanning tree is minimal-length and contained in the beta-skeleton',()=>{
 const pts=[{x:0,y:0},{x:1,y:0},{x:2,y:.1},{x:.5,y:1},{x:1.6,y:1.2}],tree=spanningTree(pts);
 assert.equal(tree.length,pts.length-1);
 for(const [i,j] of tree)assert.ok(persistence(pts,i,j)>=2,'tree edges survive the relative neighbourhood graph');
 assert.equal(persistence([{x:0,y:0},{x:2,y:0},{x:1,y:.1}],0,1),0,'a point inside the diametral circle removes the pair');
});

test('renderer-v4 range is aspect-correct and visible links cut weakest first',()=>{
 const scene={version:1,id:'wide',title:'t',subtitle:'s',image:{src:'data:image/png;base64,AA==',width:2000,height:500},
  nodes:[['l',0,.5],['r',1,.5],['t',.5,0],['b',.5,1]].map(([id,x,y])=>({id,x,y,label:id,kind:'observation',reason:'r'})),
  networks:{constellation:{title:'c',meaning:'m',edges:[{a:'l',b:'r',reason:'r',weight:.2},{a:'t',b:'b',reason:'r',weight:.9}]},structure:{title:'s',meaning:'m',edges:[]},pattern:{title:'p',meaning:'m',edges:[]}}};
 validateScene(scene);
 // Horizontal link spans the full long side; the vertical one only a quarter of it.
 assert.deepEqual(visibleGraph(scene,{...defaults,range:30}).edges.map(e=>e.a),['t']);
 assert.deepEqual(visibleGraph(scene,{...defaults,density:50}).edges.map(e=>e.a),['t'],'strongest link survives, regardless of list order');
});

test('renderer-v4 selection only filters saved links and never mutates decisions',()=>{
 for(const scene of samples){
  const before=JSON.stringify(scene);
  for(const network of ['constellation','structure','pattern'])for(const density of [10,60,100]){
   const settings={...defaults,network,density},a=visibleGraph(scene,settings);
   assert.deepEqual(a,visibleGraph(scene,settings));
   for(const e of a.edges)assert.ok(scene.networks[network].edges.includes(e));
   assert.equal(new Set(a.ranking).size,a.nodes.length);
   assert.equal(selection(scene,settings),selection(scene,settings),'memoized per scene and settings');
  }
  assert.equal(JSON.stringify(scene),before);
 }
});

test('growth draws every link from the first-reached end and cascades outward from the root',()=>{
 for(const scene of samples){
  const graph=visibleGraph(scene,defaults),plan=growth(scene,graph);
  assert.equal(plan.nodes.get(graph.ranking[0]),0,'the most important anchor is a growth root');
  for(const e of graph.edges){
   const g=plan.edges.get(edgeKey(e.a,e.b));
   assert.ok(g.start>=0&&g.start<=g.end&&g.end<=1+1e-9);
   assert.ok(Math.abs(plan.nodes.get(g.from)-g.start)<1e-9,'drawing starts where growth already is');
   assert.ok(plan.nodes.get(g.to)<=g.end+1e-9);
  }
 }
 for(const scene of samples){
  const graph=visibleGraph(scene,defaults),plan=growth(scene,graph);
  assert.deepEqual([...plan.edgeRank.values()].sort((a,b)=>a-b),graph.edges.map((_,i)=>i),'every visible link has one cascade slot');
  assert.equal(plan.nodeRank.get(graph.ranking[0]),0,'the cascade starts at the root');
  const reach=[...plan.nodeRank].sort((p,q)=>p[1]-q[1]).map(([id])=>plan.nodes.get(id));
  for(let i=1;i<reach.length;i++)assert.ok(reach[i]>=reach[i-1],'the cascade moves outward');
 }
});

test('the original v3 renderer is the default and experimental v4 projects still open',()=>{
 const bundle=v=>({version:2,rendererVersion:v,effectVersion:EFFECT_VERSION,scene:structuredClone(samples[0]),settings:{...defaults},time:1});
 assert.equal(RENDERER_VERSION,'node-network-renderer-v3');
 for(const v of ['node-network-renderer-v2','node-network-renderer-v4',RENDERER_VERSION])assert.equal(validateProject(bundle(v)).rendererVersion,v);
 const bad=bundle(RENDERER_VERSION);bad.scene.networks.pattern.edges[0].weight=2;assert.throws(()=>validateProject(bad),/weight/);
 const score=bundle(RENDERER_VERSION);score.scene.nodes[0].score=-1;assert.throws(()=>validateProject(score),/score/);
});
