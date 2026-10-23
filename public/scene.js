export function validateScene(scene) {
  if (!scene||scene.version !== 1 || typeof scene.id!=='string'||!scene.id.length||scene.id.length>100||typeof scene.title!=='string'||scene.title.length>200||typeof scene.subtitle!=='string'||scene.subtitle.length>500) throw new Error('Invalid scene metadata.');
  if(!scene.image||!Number.isInteger(scene.image.width)||!Number.isInteger(scene.image.height)||scene.image.width<1||scene.image.height<1||scene.image.width>4096||scene.image.height>4096)throw new Error('Invalid image dimensions.');
  const source=scene.image.src;
  const library=/^\/library\/([a-z0-9-]{1,60})\/image\.(png|jpg)$/.exec(typeof source==='string'?source:'');
  if(typeof source!=='string'||source.length>30_000_000||(!['/assets/butterfly-orange.png','/assets/butterfly-purple.png'].includes(source)&&!library&&!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(source)))throw new Error('Only bundled sample images, library images or embedded PNG images are allowed.');
  if(library&&library[1]!==scene.id)throw new Error('Library scenes must keep their own image.');
  if(!source.startsWith('data:image/png;base64,')&&((scene.id==='orange'&&source!=='/assets/butterfly-orange.png')||(scene.id==='purple'&&source!=='/assets/butterfly-purple.png')))throw new Error('Bundled scene identities must keep their source images.');
  if (!Array.isArray(scene.nodes) || !scene.nodes.length || scene.nodes.length>250) throw new Error('Scene needs 1–250 nodes.');
  const ids = new Set();
  for (const n of scene.nodes) {
    if (typeof n.id!=='string'||!n.id.length||n.id.length>100 || ids.has(n.id)) throw new Error('Node ids must be unique.');
    if (![n.x, n.y].every(v => Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('Anchor coordinates must be normalized.');
    if (typeof n.label!=='string'||n.label.length>200||typeof n.reason!=='string'||n.reason.length>1500 || !['observation','composition'].includes(n.kind)) throw new Error('Nodes need a label, rationale and kind.');
    if(n.score!==undefined&&!(Number.isFinite(n.score)&&n.score>=0&&n.score<=1))throw new Error('Invalid anchor score.');
    if(n.labelOffset&&(!Array.isArray(n.labelOffset)||n.labelOffset.length!==2||!n.labelOffset.every(v=>Number.isFinite(v)&&Math.abs(v)<=300)))throw new Error('Invalid label offset.');
    ids.add(n.id);
  }
  for (const key of ['constellation','structure','pattern']) {
    const graph = scene.networks?.[key];
    if (typeof graph?.meaning!=='string'||graph.meaning.length>1500||typeof graph.title!=='string'||graph.title.length>200 || !Array.isArray(graph.edges)||graph.edges.length>1500) throw new Error('Every network needs a meaning and edges.');
    for (const e of graph.edges) if (!ids.has(e.a) || !ids.has(e.b) || e.a === e.b || typeof e.reason!=='string'||e.reason.length>1500||(e.weight!==undefined&&!(Number.isFinite(e.weight)&&e.weight>=0&&e.weight<=1))) throw new Error('Edges need valid endpoints, rationale and weight.');
  }
  if(scene.rules!==undefined){
    const r=scene.rules;
    if(!r||!Array.isArray(r.roles)||r.roles.length>40||typeof r.link!=='string'||r.link.length>1500||r.roles.some(x=>typeof x?.role!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(x.role)||typeof x.rule!=='string'||x.rule.length>500))throw new Error('Invalid rule set.');
  }
  if(scene.focus&&(!Array.isArray(scene.focus)||scene.focus.length>250||scene.focus.some(id=>!ids.has(id))))throw new Error('Invalid focus anchors.');
  return scene;
}

export const defaults = Object.freeze({network:'constellation', preset:'specimen', motion:'acquire', speed:2, duration:12, density:100, labels:65, labelOpacity:100, lineWidth:0.8, opacity:60, markerSize:20, grayscale:100, exposure:84, grid:0, primary:'#f2f0e7', accent:'#e5b693', highlight:25, drift:0, imageStyle:'bw', xrayContrast:85, shape:'balanced', seed:1, range:100, maxLinks:4, fontSize:10, letterSpacing:2, avoidOverlap:true, labelMode:'observed', customLabels:'not.found, signal.lost, parse.fail, corrupt.data, null.ref, retry.{n}, {coord}', font:'mono',labelMotion:'anchored',noteTravel:14,adaptiveOverlay:true,surfaceTone:55});
export const presets = {
  specimen:{grayscale:100, exposure:84, lineWidth:0.8, opacity:60, markerSize:17, labels:65, grid:0, accent:'#e5b693'},
  natural:{grayscale:10, exposure:90, lineWidth:0.9, opacity:65, markerSize:14, labels:50, grid:0, accent:'#eac997'},
  blueprint:{grayscale:100, exposure:62, lineWidth:0.7, opacity:75, markerSize:21, labels:85, grid:35, accent:'#9fd8dd'},
  signal:{grayscale:100, exposure:58, lineWidth:0.6, opacity:42, markerSize:10, labels:40, grid:0, accent:'#f5b975'}
};
export const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function visibleGraph(scene, settings) {
  const map=new Map(scene.nodes.map(n=>[n.id,n]));
  const degrees=new Map();
  const all = scene.networks[settings.network].edges.filter(e=>{
    const a=map.get(e.a),b=map.get(e.b);
    if(Math.hypot(a.x-b.x,a.y-b.y)>settings.range/100 || (degrees.get(e.a)||0)>=settings.maxLinks || (degrees.get(e.b)||0)>=settings.maxLinks)return false;
    degrees.set(e.a,(degrees.get(e.a)||0)+1);degrees.set(e.b,(degrees.get(e.b)||0)+1);return true;
  });
  const count = Math.max(1, Math.ceil(all.length * settings.density / 100));
  const edges = all.slice(0,count);
  const ids = new Set(edges.flatMap(e => [e.a,e.b]));
  return {edges, nodes:scene.nodes.filter(n=>ids.has(n.id))};
}
export function revealAt(t, index, length, mode, duration) {
  if (mode === 'still' || mode === 'signal' || mode === 'inspect') return 1;
  const start = (index / Math.max(1,length)) * Math.min(3.5,duration * 0.3);
  return clamp((t - start) / 0.65,0,1);
}
