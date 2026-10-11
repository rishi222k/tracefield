import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixtures.mjs';
import {validateScene,defaults,presets,visibleGraph} from '../public/scene.js';
const scenes=[fixture('fixture-a'),fixture('fixture-b')];

test('every variation preserves the agent decisions and selects only authored edges',()=>{
 for(const scene of scenes){
  const before=JSON.stringify(scene);
  for(const network of ['constellation','structure','pattern'])for(const preset of Object.keys(presets))for(const density of [10,60,100]){
   const settings={...defaults,...presets[preset],preset,network,density};
   const a=visibleGraph(scene,settings),b=visibleGraph(scene,settings);
   assert.deepEqual(a,b,'a saved variation is deterministic');
   for(const edge of a.edges)assert.ok(scene.networks[network].edges.includes(edge),'no inferred edges');
   for(const node of a.nodes)assert.ok(scene.nodes.includes(node),'no generated semantic anchors');
  }
  assert.equal(JSON.stringify(scene),before,'scene decisions remain unchanged');
 }
});
test('display constraints cap degrees and range without introducing relationships',()=>{
 for(const scene of scenes)for(const network of ['constellation','structure','pattern'])for(const maxLinks of [1,2,3]){
  const graph=visibleGraph(scene,{...defaults,network,maxLinks,range:35});
  const counts=new Map();
  for(const edge of graph.edges){
   for(const id of [edge.a,edge.b])counts.set(id,(counts.get(id)||0)+1);
   const a=graph.nodes.find(n=>n.id===edge.a),b=graph.nodes.find(n=>n.id===edge.b);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<=.35);
  }
  for(const value of counts.values())assert.ok(value<=maxLinks);
 }
});
test('factual study modes use image observations rather than negative-space decoration',()=>{
 for(const scene of scenes)for(const network of ['structure','pattern']){
  const graph=visibleGraph(scene,{...defaults,network});
  assert.ok(graph.nodes.every(n=>n.kind==='observation'));
 }
});
test('bad scene files fail before rendering',()=>{
 const duplicate=structuredClone(scenes[0]);duplicate.nodes.push(duplicate.nodes[0]);assert.throws(()=>validateScene(duplicate),/unique/);
 const dangling=structuredClone(scenes[0]);dangling.networks.structure.edges[0].a='missing';assert.throws(()=>validateScene(dangling),/endpoints/);
 const out=structuredClone(scenes[0]);out.nodes[0].x=1.2;assert.throws(()=>validateScene(out),/normalized/);
});
