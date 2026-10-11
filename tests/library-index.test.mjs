import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLibraryIndex} from '../public/library-index.js';

const gallery = [{id:'demo',title:'Demo',scene:'/library/demo/scene.json',thumb:'/library/demo/image.png'}];
const json = value => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});
function fixture(local, committed = json(gallery)) {
  const calls=[];
  return {calls,fetcher:async path => {calls.push(path);return path.endsWith('index.local.json') ? local : committed;}};
}

test('a missing optional local index loads the committed gallery on development and SPA servers',async()=>{
  for(const response of [new Response('',{status:404}),new Response('<!doctype html><title>Tracefield</title>',{headers:{'content-type':'text/html; charset=utf-8'}})]){
    const f=fixture(response);
    assert.deepEqual(await loadLibraryIndex(f.fetcher),gallery);
    assert.deepEqual(f.calls,['/library/index.local.json','/library/index.json']);
  }
});
test('a local index, including an intentionally empty one, takes precedence',async()=>{
  for(const list of [[],[{...gallery[0],id:'personal'}]]){
    const f=fixture(json(list));
    assert.deepEqual(await loadLibraryIndex(f.fetcher),list);
    assert.equal(f.calls.length,1);
  }
});
test('malformed local JSON and HTTP failures do not silently hide personal studies',async()=>{
  for(const response of [new Response('{broken',{headers:{'content-type':'application/json'}}),new Response('',{status:500}),json({not:'a list'})]){
    const f=fixture(response);
    await assert.rejects(loadLibraryIndex(f.fetcher));
    assert.equal(f.calls.length,1);
  }
});
test('an unavailable or malformed committed gallery fails explicitly',async()=>{
  for(const response of [new Response('',{status:404}),new Response('<html>',{headers:{'content-type':'text/html'}}),json({not:'a list'})]){
    const f=fixture(new Response('',{status:404}),response);
    await assert.rejects(loadLibraryIndex(f.fetcher));
  }
});
