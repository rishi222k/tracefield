import test from 'node:test';
import assert from 'node:assert/strict';
import {render as trace} from '../public/render.js';
import {render as v2} from '../public/render-v2.js';
import {render as v4} from '../public/render-v4.js';
import {defaults} from '../public/scene.js';
import {PROJECT_VERSION,validateProject} from '../public/project.js';
import {RENDERER_VERSION} from '../public/settings.js';
import {EFFECT_VERSION} from '../public/image-effects.js';
import {fixture} from './fixtures.mjs';

function recording(render, opacity) {
  const text=[],markers=[],stack=[];
  const target={globalAlpha:1,
    save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},
    measureText(label){return {width:label.length*6};},
    fillText(label,x,y){text.push({label,x,y,alpha:this.globalAlpha});},
    fill(){markers.push(this.globalAlpha);},
    createLinearGradient(){return {addColorStop(){}};},
  };
  const ctx=new Proxy(target,{get:(obj,key)=>key in obj?obj[key]:(()=>{})});
  const scene=fixture();
  render(ctx,{width:320,height:240},scene,{...defaults,motion:'still',labelOpacity:opacity},5.5,800,600);
  return {text,markers};
}
test('label opacity fades the same positioned labels without fading markers in every preserved renderer',()=>{
  for(const render of [trace,v2,v4]){
    const full=recording(render,100),half=recording(render,50),hidden=recording(render,0);
    assert.ok(full.text.length>0);
    assert.deepEqual(half.text.map(({alpha,...rest})=>rest),full.text.map(({alpha,...rest})=>rest));
    assert.deepEqual(hidden.text.map(({alpha,...rest})=>rest),full.text.map(({alpha,...rest})=>rest));
    for(let i=0;i<full.text.length;i++){
      assert.equal(half.text[i].alpha,full.text[i].alpha*.5);
      assert.equal(hidden.text[i].alpha,0);
    }
    assert.deepEqual(half.markers,full.markers);
    assert.deepEqual(hidden.markers,full.markers);
  }
});
test('v3 projects retain opacity while old projects keep their label selection and full opacity',()=>{
  const project={version:PROJECT_VERSION,rendererVersion:RENDERER_VERSION,effectVersion:EFFECT_VERSION,scene:fixture(),settings:{...defaults,labelOpacity:37},time:5.5};
  assert.equal(validateProject(JSON.parse(JSON.stringify(project))).settings.labelOpacity,37);
  const legacy={...project,version:2,settings:{...defaults,labels:35}};
  delete legacy.settings.labelOpacity;
  const restored=validateProject(legacy);
  assert.equal(restored.settings.labels,35);
  assert.equal(restored.settings.labelOpacity,100);
  for(const value of [-1,101,NaN,undefined])assert.throws(()=>validateProject({...project,settings:{...project.settings,labelOpacity:value}}));
  assert.throws(()=>validateProject({...project,version:4}));
});
