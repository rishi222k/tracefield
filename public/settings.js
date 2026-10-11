import {defaults,presets} from './scene.js';
export const RENDERER_VERSION='node-network-renderer-v3';
export const START_FRAME=0;
export const ranges=[
 ['speed','Speed',.25,3,.05,'×','motionControls'],['duration','Loop duration',5,24,1,'s','motionControls'],['drift','Background drift',0,8,.5,'px','motionControls'],
 ['density','Visible links',10,100,1,'%','networkControls'],['range','Connection range',15,100,1,'%','networkControls'],['maxLinks','Max links per node',1,8,1,'','networkControls'],['markerSize','Marker size',6,44,1,'px','networkControls'],
 ['highlight','Highlight mix',0,100,1,'%','styleControls'],['opacity','Line opacity',5,100,1,'%','styleControls'],['lineWidth','Line width',.3,2.5,.1,'px','styleControls'],['grid','Grid overlay',0,100,1,'%','styleControls'],
 ['surfaceTone','Surface tones',0,100,1,'%','imageControls'],
 ['exposure','Brightness',40,130,1,'%','imageControls'],['xrayContrast','Treatment intensity',10,100,1,'%','imageControls'],
 ['labels','Label density',0,100,1,'%','labelControls'],['fontSize','Type size',8,16,.5,'px','labelControls'],['letterSpacing','Letter spacing',0,12,1,'%','labelControls'],['noteTravel','Note travel',0,35,1,'px','labelControls']
];
export function normalizeSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Missing presentation settings.');
 const next={...defaults};for(const key of Object.keys(defaults))if(Object.hasOwn(input,key))next[key]=input[key];
 for(const [key,,min,max] of ranges)if(typeof next[key]!=='number'||!Number.isFinite(next[key])||next[key]<min||next[key]>max)throw new Error('Invalid '+key+' setting.');
 for(const key of ['maxLinks','seed'])if(!Number.isInteger(next[key]))throw new Error('Invalid '+key+' integer.');
 for(const [key,values] of Object.entries({network:['constellation','structure','pattern'],preset:Object.keys(presets),motion:['acquire','scan','signal','inspect','still'],shape:['balanced','brackets','frames','dots','rings','crosshairs','diamonds'],imageStyle:['original','bw','xray','darkfield','blueprint'],labelMode:['observed','diagnostic','fashion'],labelMotion:['anchored','float'],font:['mono','courier']}))if(!values.includes(next[key]))throw new Error('Invalid '+key+'.');
 for(const key of ['primary','accent'])if(typeof next[key]!=='string'||!/^#[a-f\d]{6}$/i.test(next[key]))throw new Error('Invalid color.');
 if(next.seed<1||next.seed>9999||typeof next.avoidOverlap!=='boolean'||typeof next.adaptiveOverlay!=='boolean'||typeof next.customLabels!=='string'||next.customLabels.length>4000)throw new Error('Invalid presentation values.');
 if(typeof next.grayscale!=='number'||!Number.isFinite(next.grayscale)||next.grayscale<0||next.grayscale>100)throw new Error('Invalid grayscale value.');
 return next;
}

export function overlayColors(s){
 if(s.adaptiveOverlay&&s.imageStyle==='blueprint')return {primary:'#eaf6ff',accent:'#8fdcff'};
 if(s.adaptiveOverlay&&s.imageStyle==='xray')return {primary:'#142726',accent:'#79512e'};
 if(s.adaptiveOverlay&&s.imageStyle==='darkfield')return {primary:'#edf3ec',accent:'#e5bc86'};
 return {primary:s.primary,accent:s.accent};
}
