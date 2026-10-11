import {clamp} from './scene.js';
export const GRAPH_VERSION='graph-v1';

// Pure, deterministic graph geometry shared by the proposal and renderer v4.
// Coordinates are normalized per axis, so every distance is first mapped to
// image space scaled by the longer side; ranges stay round on any aspect ratio.
export function space(image){const m=Math.max(image.width,image.height);return {sx:image.width/m,sy:image.height/m};}
export const toSpace=(n,s)=>({x:n.x*s.sx,y:n.y*s.sy});
export const length=(a,b,s)=>Math.hypot((a.x-b.x)*s.sx,(a.y-b.y)*s.sy);
export const edgeKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;

// Prim's minimum spanning tree with index tie-breaks. Returns index pairs.
export function spanningTree(points){
 const n=points.length,used=new Uint8Array(n),best=new Float64Array(n).fill(Infinity),from=new Int32Array(n).fill(-1),out=[];
 if(!n)return out;best[0]=0;
 for(let k=0;k<n;k++){
  let v=-1;for(let i=0;i<n;i++)if(!used[i]&&(v<0||best[i]<best[v]))v=i;
  used[v]=1;if(from[v]>=0)out.push(from[v]<v?[from[v],v]:[v,from[v]]);
  for(let i=0;i<n;i++)if(!used[i]){const d=Math.hypot(points[i].x-points[v].x,points[i].y-points[v].y);if(d<best[i]){best[i]=d;from[i]=v;}}
 }
 return out;
}

// Lune-based beta-skeleton. beta=1 is the Gabriel graph, beta=2 the relative
// neighbourhood graph; the edge sets are nested, so the largest beta an edge
// survives is a stable "persistence" score. Returns 0 for non-Gabriel pairs.
const inLune=(p,q,r,beta)=>{
 const d=Math.hypot(q.x-p.x,q.y-p.y),R=beta*d/2,k=beta/2;
 const c1={x:(1-k)*p.x+k*q.x,y:(1-k)*p.y+k*q.y},c2={x:k*p.x+(1-k)*q.x,y:k*p.y+(1-k)*q.y};
 return Math.hypot(r.x-c1.x,r.y-c1.y)<R-1e-12&&Math.hypot(r.x-c2.x,r.y-c2.y)<R-1e-12;
};
export const MAX_BETA=3;
export function persistence(points,i,j){
 const p=points[i],q=points[j];let limit=MAX_BETA;
 for(let k=0;k<points.length;k++){
  if(k===i||k===j)continue;const r=points[k];
  if(inLune(p,q,r,1))return 0;
  if(!inLune(p,q,r,limit))continue;
  let lo=1,hi=limit;for(let s=0;s<24;s++){const mid=(lo+hi)/2;if(inLune(p,q,r,mid))hi=mid;else lo=mid;}
  limit=lo;
 }
 return limit;
}

export function segmentsCross(a,b,c,d){
 const o=(p,q,r)=>{const v=(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);return Math.abs(v)<1e-12?0:Math.sign(v);};
 return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;
}

// Fallback importance for scenes saved without edge weights (agent-authored
// scenes): backbone links first, then shorter links. Ordering only.
function derivedWeights(edges,map,s){
 const lengths=edges.map(e=>length(map.get(e.a),map.get(e.b),s));
 const order=edges.map((_,i)=>i).sort((i,j)=>lengths[i]-lengths[j]||i-j),parent=new Map(),find=v=>{while(parent.get(v)!==v){parent.set(v,parent.get(parent.get(v)));v=parent.get(v);}return v;};
 for(const e of edges){parent.set(e.a,e.a);parent.set(e.b,e.b);}
 const weights=new Array(edges.length),max=Math.max(1e-9,...lengths);
 order.forEach((i,rank)=>{const a=find(edges[i].a),b=find(edges[i].b);const backbone=a!==b;if(backbone)parent.set(a,b);weights[i]=(backbone?.6:0)+.4*(1-rank/Math.max(1,edges.length));});
 return {weights,lengths,max};
}

// Renderer-v4 selection, memoized per scene object and selection settings.
const memo=new WeakMap();
export function selection(scene,settings){
 const key=[settings.network,settings.range,settings.maxLinks,settings.density].join('|');
 let byKey=memo.get(scene);if(!byKey)memo.set(scene,byKey=new Map());
 if(!byKey.has(key)){const graph=visibleGraph(scene,settings);byKey.set(key,{graph,plan:growth(scene,graph)});}
 return byKey.get(key);
}
// Renderer-v4 selection. Filters only saved edges: strongest first, then the
// aspect-correct range, the per-node cap and the visible-link share.
export function visibleGraph(scene,settings){
 const s=space(scene.image),map=new Map(scene.nodes.map(n=>[n.id,n])),saved=scene.networks[settings.network].edges;
 const derived=derivedWeights(saved,map,s);
 const order=saved.map((e,i)=>({e,i,w:Number.isFinite(e.weight)?e.weight:derived.weights[i],len:derived.lengths[i]})).sort((p,q)=>q.w-p.w||p.i-q.i);
 const degrees=new Map(),kept=[];
 for(const r of order){
  if(r.len>settings.range/100||(degrees.get(r.e.a)||0)>=settings.maxLinks||(degrees.get(r.e.b)||0)>=settings.maxLinks)continue;
  degrees.set(r.e.a,(degrees.get(r.e.a)||0)+1);degrees.set(r.e.b,(degrees.get(r.e.b)||0)+1);kept.push(r.e);
 }
 const edges=kept.slice(0,Math.max(1,Math.ceil(kept.length*settings.density/100)));
 const ids=new Set(edges.flatMap(e=>[e.a,e.b]));
 const nodes=scene.nodes.filter(n=>ids.has(n.id));
 const degree=new Map();for(const e of edges)for(const id of [e.a,e.b])degree.set(id,(degree.get(id)||0)+1);
 const focus=new Set(scene.focus||[]);
 const importance=n=>(focus.has(n.id)?2:0)+(Number.isFinite(n.score)?n.score:0)+(n.kind==='observation'?.5:0)+(degree.get(n.id)||0)*.05;
 // Spread-aware ranking: importance discounted near anchors already ranked,
 // so label density and growth roots cover the frame instead of one cluster.
 const pool=nodes.map((n,i)=>({n,i,v:importance(n),p:toSpace(n,s)})),ranked=[];
 while(pool.length){
  let best=0,bestKey=-Infinity;
  pool.forEach((c,k)=>{const d=ranked.length?Math.min(...ranked.map(r=>Math.hypot(r.p.x-c.p.x,r.p.y-c.p.y))):1,key=(c.v+.1)*Math.min(1,d/.2);if(key>bestKey+1e-12||(Math.abs(key-bestKey)<=1e-12&&c.i<pool[best].i)){best=k;bestKey=key;}});
  ranked.push(pool.splice(best,1)[0]);
 }
 return {edges,nodes,ranking:ranked.map(r=>r.n.id)};
}

// Growth schedule: each component grows from its most important anchor along
// shortest paths. Lines draw from the end that is reached first. Values are
// normalized path distances in [0,1]; ranks order the acquisition cascade.
export function growth(scene,graph){
 const s=space(scene.image),map=new Map(graph.nodes.map(n=>[n.id,n])),adj=new Map(graph.nodes.map(n=>[n.id,[]]));
 for(const e of graph.edges){const l=length(map.get(e.a),map.get(e.b),s);adj.get(e.a).push([e.b,l]);adj.get(e.b).push([e.a,l]);}
 const dist=new Map();
 for(const root of graph.ranking){
  if(dist.has(root))continue;
  const queue=[[0,root]];dist.set(root,0);
  while(queue.length){
   queue.sort((p,q)=>p[0]-q[0]||(p[1]<q[1]?-1:p[1]>q[1]?1:0));
   const [d,v]=queue.shift();if(d>dist.get(v))continue;
   for(const [w,l] of adj.get(v)){if(!dist.has(w)||d+l<dist.get(w)-1e-12){dist.set(w,d+l);queue.push([d+l,w]);}}
  }
 }
 const edges=new Map();let total=1e-9;
 for(const e of graph.edges){
  const da=dist.get(e.a),db=dist.get(e.b),l=length(map.get(e.a),map.get(e.b),s);
  const forward=da<db||(da===db&&e.a<e.b),start=Math.min(da,db);
  edges.set(edgeKey(e.a,e.b),{from:forward?e.a:e.b,to:forward?e.b:e.a,start,end:start+l});total=Math.max(total,start+l);
 }
 for(const v of edges.values()){v.start/=total;v.end/=total;}
 const nodes=new Map([...dist].map(([id,d])=>[id,clamp(d/total,0,1)]));
 // Cascade order: the v3 acquisition envelope staggers by rank, so ranking
 // by reach makes the same effect sweep outward from the root.
 const byStart=(m,key)=>new Map([...m].sort((p,q)=>key(p[1])-key(q[1])||(p[0]<q[0]?-1:p[0]>q[0]?1:0)).map(([id],i)=>[id,i]));
 return {edges,nodes,edgeRank:byStart(edges,v=>v.start+v.end*1e-6),nodeRank:byStart(nodes,v=>v)};
}
