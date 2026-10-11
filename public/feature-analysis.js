import {spanningTree,persistence,segmentsCross,edgeKey} from './graph.js';
export const FEATURE_ANALYSIS_VERSION='feature-proposal-v3';

// Deterministic local proposal: measured spots and corners weighted by a
// saliency map, plus negative-space anchors. Fixed parameters, no randomness,
// no model calls. Labels report measurements (tone, colour, shape), never
// object identity; an agent may replace this scene with a semantic one.
const WORK=384,SUBJECT=22,FIELD=8,HALO=[.025,.075],ENVELOPE=.08,MIN_GAP=.04,SPREAD=.11,MARGIN=.025;

function resample(rgba,width,height){
 const scale=Math.min(1,WORK/Math.max(width,height)),W=Math.max(1,Math.round(width*scale)),H=Math.max(1,Math.round(height*scale));
 const sum=new Float64Array(W*H*3),count=new Float64Array(W*H);
 for(let y=0;y<height;y++){const ty=Math.min(H-1,Math.floor(y*H/height));for(let x=0;x<width;x++){
  const tx=Math.min(W-1,Math.floor(x*W/width)),i=(y*width+x)*4,a=rgba[i+3]/255,t=ty*W+tx;
  for(let c=0;c<3;c++)sum[t*3+c]+=(rgba[i+c]*a+255*(1-a))/255;count[t]++;
 }}
 const R=new Float32Array(W*H),G=new Float32Array(W*H),B=new Float32Array(W*H),L=new Float32Array(W*H);
 for(let i=0;i<W*H;i++){R[i]=sum[i*3]/count[i];G[i]=sum[i*3+1]/count[i];B[i]=sum[i*3+2]/count[i];L[i]=.2126*R[i]+.7152*G[i]+.0722*B[i];}
 return {W,H,R,G,B,L};
}
function pass(src,W,H,r,horizontal){
 const out=new Float32Array(src.length),n=2*r+1,len=horizontal?W:H,lines=horizontal?H:W;
 for(let line=0;line<lines;line++){
  const at=k=>horizontal?line*W+Math.max(0,Math.min(W-1,k)):Math.max(0,Math.min(H-1,k))*W+line;
  let sum=0;for(let k=-r;k<=r;k++)sum+=src[at(k)];
  for(let k=0;k<len;k++){out[horizontal?line*W+k:k*W+line]=sum/n;sum+=src[at(k+r+1)]-src[at(k-r)];}
 }
 return out;
}
// Three box passes approximate a Gaussian with sigma = sqrt(r(r+1)).
export function blur(src,W,H,r){let a=src;for(let p=0;p<3;p++)a=pass(pass(a,W,H,r,true),W,H,r,false);return a;}
function quantile(values,q){const s=[];for(let i=0;i<values.length;i+=Math.max(1,Math.floor(values.length/4000)))s.push(values[i]);s.sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(q*(s.length-1)))]||0;}
const median=v=>{const s=[...v].sort((a,b)=>a-b);return s[s.length>>1]||0;};

// Region saliency in [0,1] from three cues: colour distance from the border's
// median colour, global colour rarity (how unlike the rest of the image a
// colour is) and focus (local Laplacian energy). Blurred to region scale.
export const SALIENCY_WEIGHTS=Object.freeze({border:.25,rarity:.5,focus:.25});
export function saliencyMap({W,H,R,G,B,L},weights=SALIENCY_WEIGHTS){
 const Lc=blur(L,W,H,1),Ac=blur(R.map((r,i)=>r-G[i]),W,H,1),Bc=blur(R.map((r,i)=>(r+G[i])/2-B[i]),W,H,1);
 const ring=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x<W*.06||x>=W*.94||y<H*.06||y>=H*.94)ring.push(y*W+x);
 const mL=median(ring.map(i=>Lc[i])),mA=median(ring.map(i=>Ac[i])),mB=median(ring.map(i=>Bc[i]));
 const contrast=new Float32Array(W*H),lap=new Float32Array(W*H);
 for(let i=0;i<W*H;i++)contrast[i]=Math.hypot(Lc[i]-mL,1.5*(Ac[i]-mA),1.5*(Bc[i]-mB));
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;lap[i]=Math.abs(4*L[i]-L[i-1]-L[i+1]-L[i-W]-L[i+W]);}
 // Global colour rarity over a 16x16 opponent-chroma histogram: hues that are
 // uncommon in this image stand out regardless of brightness.
 const N=16,bin=new Uint16Array(W*H),count=new Float64Array(N*N),ca=new Float64Array(N*N),cb=new Float64Array(N*N);
 for(let i=0;i<W*H;i++){const a=Ac[i],b=Bc[i],q=v=>Math.max(0,Math.min(N-1,Math.floor((v+1)/2*N))),k=q(a)*N+q(b);bin[i]=k;count[k]++;ca[k]+=a;cb[k]+=b;}
 const used=[];for(let k=0;k<N*N;k++)if(count[k])used.push(k);
 const rare=new Float64Array(N*N);
 for(const x of used)for(const y of used)rare[x]+=count[y]/(W*H)*Math.hypot(ca[x]/count[x]-ca[y]/count[y],cb[x]/count[x]-cb[y]/count[y]);
 const rarity=blur(Float32Array.from(bin,k=>rare[k]),W,H,2);
 const focus=blur(lap,W,H,4),qc=quantile(contrast,.98)||1,qf=quantile(focus,.98)||1,qr=quantile(rarity,.98)||1;
 const raw=new Float32Array(W*H);
 for(let i=0;i<W*H;i++)raw[i]=weights.border*Math.min(1,contrast[i]/qc)+weights.rarity*Math.min(1,rarity[i]/qr)+weights.focus*Math.min(1,focus[i]/qf);
 const S=blur(raw,W,H,2),qs=quantile(S,.98)||1,peaks=new Float32Array(W*H);
 // Unclipped copy keeps distinct maxima inside saturated regions.
 for(let i=0;i<W*H;i++){peaks[i]=S[i]/qs;S[i]=Math.min(1,peaks[i]);}
 S.peaks=peaks;return S;
}
// The saliency map at working resolution, for the comparison page.
export function saliencyPreview(rgba,width,height,weights){const img=resample(rgba,width,height);return {W:img.W,H:img.H,S:saliencyMap(img,weights)};}

function colourName(r,g,b){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,c=max-min;
 if(c<.1||c/(1-Math.abs(2*l-1)+1e-9)<.2)return l>.8?'white':l>.6?'pale':l>.36?'gray':l>.16?'dark':'black';
 let h=max===r?((g-b)/c)%6:max===g?(b-r)/c+2:(r-g)/c+4;h=(h*60+360)%360;
 return h<15||h>=345?'red':h<42?'orange':h<68?'yellow':h<160?'green':h<200?'teal':h<255?'blue':h<295?'violet':'magenta';
}

function hull(points){
 points.sort((a,b)=>a.x-b.x||a.y-b.y);
 const cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lower=[],upper=[];
 for(const p of points){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of [...points].reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function tips(S,W,H,edge){
 const boundary=[];
 for(let y=edge;y<H-edge;y++){let first=-1,last=-1;for(let x=edge;x<W-edge;x++)if(S[y*W+x]>=.5){if(first<0)first=x;last=x;}if(first>=0){boundary.push({x:first,y});if(last!==first)boundary.push({x:last,y});}}
 if(boundary.length<3)return [];
 const h=hull(boundary),M=Math.max(W,H),out=[];
 const r1=Math.max(3,Math.round(M*.04));
 // Share of salient pixels in a disc, and their centroid.
 const disc=(p,r)=>{let n=0,in_=0,cx=0,cy=0;for(let y=Math.max(0,p.y-r);y<=Math.min(H-1,p.y+r);y++)for(let x=Math.max(0,p.x-r);x<=Math.min(W-1,p.x+r);x++){if((x-p.x)**2+(y-p.y)**2>r*r)continue;n++;if(S[y*W+x]>=.5){in_++;cx+=x;cy+=y;}}return {share:in_/n,x:in_?cx/in_:p.x,y:in_?cy/in_:p.y};};
 // The blurred map is wider than the subject: walk toward the local body onto solid saliency.
 const inward=(p,c)=>{const len=Math.hypot(c.x-p.x,c.y-p.y)||1;let q=p;for(let s=0;s<=r1;s++){q={x:Math.round(p.x+(c.x-p.x)*s/len),y:Math.round(p.y+(c.y-p.y)*s/len)};if(S[q.y*W+q.x]>=.8)break;}return q;};
 for(let k=0;k<h.length;k++){
  // Interior angle against neighbours a short arc away, so pixel steps do not count as corners.
  const p=h[k],reach=M*.06,find=dir=>{for(let s=1;s<h.length;s++){const q=h[(k+dir*s+h.length*s)%h.length];if(Math.hypot(q.x-p.x,q.y-p.y)>=reach)return q;}return null;};
  const a=find(-1),b=find(1);if(!a||!b)continue;
  const v1={x:a.x-p.x,y:a.y-p.y},v2={x:b.x-p.x,y:b.y-p.y},angle=Math.acos(Math.max(-1,Math.min(1,(v1.x*v2.x+v1.y*v2.y)/(Math.hypot(v1.x,v1.y)*Math.hypot(v2.x,v2.y)))));
  // Touching the analysis margin means the silhouette leaves the frame: not a tip.
  if(!(angle<Math.PI*.8&&p.x>edge&&p.x<W-1-edge&&p.y>edge&&p.y<H-1-edge))continue;
  // A protrusion is narrow near the vertex and widens into a body further in;
  // an isolated small shape thins out instead and is left to the spot detector.
  const near=disc(p,r1),far=disc(p,r1*3);
  if(near.share<.55&&far.share>=near.share*.6){const q=inward(p,near);out.push({x:q.x,y:q.y,i:q.y*W+q.x,response:1,sharp:1-angle/Math.PI});}
 }
 return out;
}
function detect(img,S){
 const {W,H,L}=img,G1=blur(L,W,H,1),levels=[G1,blur(L,W,H,2),blur(L,W,H,4),blur(L,W,H,7)],sigma=[1.41,2.45,4.47,7.48];
 const Ixx=new Float32Array(W*H),Iyy=new Float32Array(W*H),Ixy=new Float32Array(W*H);
 for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
  const i=y*W+x,gx=(G1[i-W+1]+2*G1[i+1]+G1[i+W+1]-G1[i-W-1]-2*G1[i-1]-G1[i+W-1])/8,gy=(G1[i+W-1]+2*G1[i+W]+G1[i+W+1]-G1[i-W-1]-2*G1[i-W]-G1[i-W+1])/8;
  Ixx[i]=gx*gx;Iyy[i]=gy*gy;Ixy[i]=gx*gy;
 }
 const a=blur(Ixx,W,H,1),c=blur(Iyy,W,H,1),b=blur(Ixy,W,H,1),corner=new Float32Array(W*H);
 for(let i=0;i<W*H;i++)corner[i]=Math.max(0,(a[i]+c[i])/2-Math.sqrt(((a[i]-c[i])/2)**2+b[i]**2));
 const blob=new Float32Array(W*H),scale=new Uint8Array(W*H),sign=new Int8Array(W*H);
 for(let s=0;s<3;s++)for(let i=0;i<W*H;i++){const d=levels[s][i]-levels[s+1][i];if(Math.abs(d)>blob[i]){blob[i]=Math.abs(d);scale[i]=s;sign[i]=d>0?1:-1;}}
 const edge=Math.max(2,Math.round(Math.max(W,H)*MARGIN)),out=[];
 const peak=(map,i,x,y,r)=>{for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(!dx&&!dy)continue;const j=(y+dy)*W+x+dx;if(map[j]>map[i]||(map[j]===map[i]&&j<i))return false;}return true;};
 for(let y=edge;y<H-edge;y++)for(let x=edge;x<W-edge;x++){
  const i=y*W+x;
  if(corner[i]>0&&peak(corner,i,x,y,2))out.push({x,y,i,type:'corner',response:corner[i],sign:0,scale:0});
  if(blob[i]>0&&peak(blob,i,x,y,2)){
   // Reject edge-like DoG ridges with the Hessian ratio test.
   const D=levels[scale[i]],dxx=D[i+1]+D[i-1]-2*D[i],dyy=D[i+W]+D[i-W]-2*D[i],dxy=(D[i+W+1]-D[i+W-1]-D[i-W+1]+D[i-W-1])/4,tr=dxx+dyy,det=dxx*dyy-dxy*dxy;
   if(det>0&&tr*tr/det<12.1)out.push({x,y,i,type:'spot',response:blob[i],sign:sign[i],scale:scale[i],radius:sigma[scale[i]+1]*1.2});
  }
 }
 for(const type of ['corner','spot']){
  const group=out.filter(p=>p.type===type),q=quantile(group.map(p=>p.response).sort((a,b)=>a-b),.9)||1;
  for(const p of group)p.score=Math.min(1.5,p.response/q)*(type==='spot'?1.3:1)*(.1+.9*S[p.i]**1.5);
 }
 // Region cores: local maxima of saliency (the centre of what stands out).
 const coreR=Math.max(3,Math.round(Math.max(W,H)*.08)),cores=[];
 for(let y=edge;y<H-edge;y++)for(let x=edge;x<W-edge;x++){const i=y*W+x;if(S[i]>=.75&&peak(S.peaks,i,x,y,Math.min(coreR,x,y,W-1-x,H-1-y)))cores.push({x,y,i,type:'core',response:S.peaks[i],sign:0,scale:0,score:1.2});}
 out.push(...cores.sort((p,q)=>q.response-p.response||p.i-q.i).slice(0,3));
 // Silhouette tips: sharp vertices of the convex hull of the salient region.
 for(const t of tips(S,W,H,edge))out.push({...t,type:'tip',sign:0,scale:0,score:1.3+.3*t.sharp});
 return out.sort((p,q)=>q.score-p.score||p.i-q.i);
}

// Subject envelope: distance from every pixel to the salient subject (two-pass
// chamfer transform), in units of the image's long side.
function subjectEnvelope(S,W,H,M,enabled){
 const subjectDist=new Float32Array(W*H);
 for(let i=0;i<W*H;i++)subjectDist[i]=S[i]>=.45?0:1e9;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;if(x)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i-1]+1);if(y)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i-W]+1);if(x&&y)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i-W-1]+1.414);if(y&&x<W-1)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i-W+1]+1.414);}
 for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){const i=y*W+x;if(x<W-1)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i+1]+1);if(y<H-1)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i+W]+1);if(x<W-1&&y<H-1)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i+W+1]+1.414);if(y<H-1&&x)subjectDist[i]=Math.min(subjectDist[i],subjectDist[i+W-1]+1.414);}
 const hasSubject=enabled&&subjectDist.some(v=>v===0);
 const dAt=(x,y)=>hasSubject?subjectDist[Math.min(H-1,Math.max(0,Math.round(y*H-.5)))*W+Math.min(W-1,Math.max(0,Math.round(x*W-.5)))]/M:0;
 return {dAt,hasSubject};
}

// Constellation rule: link neighbours (Gabriel graph: no other point inside
// the circle spanning the pair) only where the whole line stays on the subject
// or within its halo band. Separate parts of the subject are joined by the
// fewest, shortest bridges between subject points. Planar by construction.
function subjectNet(nodes,W,H,M,dAt,hasSubject,dropLoose){
 const space=n=>({x:n.x*W/M,y:n.y*H/M}),gap=(p,q)=>Math.hypot((p.x-q.x)*W/M,(p.y-q.y)*H/M);
 const reach=(a,b)=>{let max=0;for(let k=0;k<=16;k++)max=Math.max(max,dAt(a.x+(b.x-a.x)*k/16,a.y+(b.y-a.y)*k/16));return max;};
 const edge=(a,b,reason,weight)=>({a:a.id,b:b.id,reason,weight:+weight.toFixed(4)});
 const pts=nodes.map(space),pairs0=[];
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const p=persistence(pts,i,j);if(!p)continue;
  const a=nodes[i],b=nodes[j];if(hasSubject&&a.kind==='composition'&&b.kind==='composition')continue;
  pairs0.push({a,b,p,len:Math.hypot(pts[i].x-pts[j].x,pts[i].y-pts[j].y),out:reach(a,b)});
 }
 const link=new Map(nodes.map(n=>[n.id,n.id])),root=v=>{while(link.get(v)!==v)v=link.get(v);return v;},constellation=[];
 for(const q of pairs0)if(q.out<=ENVELOPE){link.set(root(q.a.id),root(q.b.id));constellation.push(edge(q.a,q.b,q.a.kind==='composition'||q.b.kind==='composition'?'Halo link: neighbours, joined just outside the subject\'s edge.':'Neighbours: no other point lies inside the circle spanning this pair, and the line stays on the subject.',Math.min(1,.4+.2*q.p)*(1-q.out/ENVELOPE*.5)));}
 for(const q of pairs0.filter(q=>q.out>ENVELOPE&&q.a.kind==='observation'&&q.b.kind==='observation').sort((x,y)=>x.out-y.out||x.len-y.len||(x.a.id+x.b.id<y.a.id+y.b.id?-1:1))){
  const ra=root(q.a.id),rb=root(q.b.id);if(ra===rb)continue;link.set(ra,rb);
  constellation.push(edge(q.a,q.b,'Bridge: the shortest neighbour link joining two separate parts of the subject.',.3));
 }
 // Any part still apart (rare halo arrangements) joins by its shortest crossing-free link.
 const at=new Map(nodes.map(n=>[n.id,space(n)]));
 for(let guard=0;guard<nodes.length;guard++){
  const roots=new Set(nodes.filter(n=>n.kind==='observation').map(n=>root(n.id)));if(roots.size<2)break;
  let best=null;
  for(const a of nodes)for(const b of nodes){
   if(a.id>=b.id||root(a.id)===root(b.id)||a.kind!=='observation'||b.kind!=='observation')continue;
   const len=gap(a,b);if(best&&len>=best.len)continue;
   if(constellation.some(f=>![f.a,f.b].includes(a.id)&&![f.a,f.b].includes(b.id)&&segmentsCross(at.get(a.id),at.get(b.id),at.get(f.a),at.get(f.b))))continue;
   best={a,b,len};
  }
  if(!best)break;link.set(root(best.a.id),root(best.b.id));
  constellation.push(edge(best.a,best.b,'Bridge: the shortest link joining two separate parts of the subject.',.3));
 }
 // A halo point whose only neighbours are other halo points carries no link; drop it.
 const linked=new Set(constellation.flatMap(e=>[e.a,e.b]));
 if(hasSubject&&dropLoose)for(let k=nodes.length-1;k>=0;k--)if(nodes[k].kind==='composition'&&!linked.has(nodes[k].id))nodes.splice(k,1);
 // Cascade order: the original renderer reveals links in list order, top to bottom.
 const yOf=new Map(nodes.map(n=>[n.id,n.y]));
 constellation.sort((e,f)=>Math.min(yOf.get(e.a),yOf.get(e.b))-Math.min(yOf.get(f.a),yOf.get(f.b))||Math.max(yOf.get(e.a),yOf.get(e.b))-Math.max(yOf.get(f.a),yOf.get(f.b))||(e.a+e.b<f.a+f.b?-1:1));
 return constellation;
}

// Applies the subject-bound constellation rule to an existing scene's points
// (for example an agent-authored scene), leaving its points and labels as they are.
export function subjectConstellation(scene,rgba,width,height){
 const img=resample(rgba,width,height),{W,H}=img,M=Math.max(W,H),S=saliencyMap(img);
 const {dAt,hasSubject}=subjectEnvelope(S,W,H,M,scene.nodes.filter(n=>n.kind==='observation').length>1);
 return subjectNet(scene.nodes.map(n=>({...n})),W,H,M,dAt,hasSubject,false);
}

export function analyzeFeatures(rgba,width,height,identity,image){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4)throw new Error('Invalid analysis pixels.');
 const img=resample(rgba,width,height),{W,H}=img,M=Math.max(W,H),S=saliencyMap(img);
 const R1=blur(img.R,W,H,1),G1=blur(img.G,W,H,1),B1=blur(img.B,W,H,1);
 const sAt=(x,y)=>S[Math.min(H-1,Math.max(0,Math.round(y*H-.5)))*W+Math.min(W-1,Math.max(0,Math.round(x*W-.5)))];
 const gap=(p,q)=>Math.hypot((p.x-q.x)*W/M,(p.y-q.y)*H/M);
 const floor=c=>c.score>=Math.max(.05,top*.12),detected=W>=16&&H>=16?detect(img,S):[],top=detected[0]?.score||0;
 const candidates=detected.filter(floor).map(c=>({...c,x:(c.x+.5)/W,y:(c.y+.5)/H})),chosen=[];
 // Spread-aware greedy selection: score discounted by proximity to points
 // already chosen, so strong detail cannot crowd out the rest of the subject.
 while(chosen.length<SUBJECT){
  let best=null,bestKey=0;
  for(const c of candidates){
   const d=chosen.length?Math.min(...chosen.map(q=>gap(c,q))):1;if(d<MIN_GAP)continue;
   const key=c.score*Math.min(1,d/SPREAD);if(key>bestKey+1e-12){best=c;bestKey=key;}
  }
  if(!best)break;chosen.push(best);
 }
 // Points read top to bottom, like the original cascade. Each label names the
 // point's role, which is also the rule that placed it.
 chosen.sort((a,b)=>a.y-b.y||a.x-b.x);
 const ROLE={core:'focus',tip:'tip',spot:'mark',corner:'contour'},count={};
 const features=chosen.map((p,k)=>{
  const colour=colourName(R1[p.i],G1[p.i],B1[p.i]),role=ROLE[p.type];
  count[role]=(count[role]||0)+1;
  const label=`${role}.${String(count[role]).padStart(2,'0')}`,tone=p.type==='spot'?(p.sign>0?'light':'dark'):'';
  const what={spot:`Mark: a distinct ${tone} spot on the subject.`,corner:'Contour: a sharp turn where the subject\'s outline or pattern changes direction.',tip:'Tip: an outermost point of the subject\'s silhouette.',core:'Focus: the centre of the most salient region.'}[p.type];
  return {id:`feature-${k+1}`,x:+p.x.toFixed(5),y:+p.y.toFixed(5),label,kind:'observation',reason:what+' Measured from pixels; no semantic object identity is inferred.',
   labelOffset:[p.x>.55?-(26+label.length*6.4):26,(k%2?-1:1)*22],score:+Math.min(1,p.score/(top||1)).toFixed(4),
   feature:{type:p.type,tone,colour,scale:p.scale,rgb:[R1[p.i],G1[p.i],B1[p.i]].map(v=>+v.toFixed(4)),salience:+S[p.i].toFixed(4)}};
 });
 const {dAt,hasSubject}=subjectEnvelope(S,W,H,M,features.length>1);
 // Halo: a few points just outside the subject's edge, spaced apart, so the net
 // can wrap the subject without reaching into the background.
 const field=[],grid=[],cols=48,rows=Math.max(4,Math.round(48*H/W));
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)grid.push({x:.04+.92*(c+.5)/cols,y:.04+.92*(r+.5)/rows});
 for(let k=0;k<FIELD;k++){
  let best=null,bestKey=-1;
  for(const g of grid){
   const d=dAt(g.x,g.y);if(hasSubject&&(d<HALO[0]||d>HALO[1]))continue;
   const apart=Math.min(...[...features,...field].map(o=>gap(g,o)),1);if(apart<(hasSubject?.08:0))continue;
   if(apart>bestKey+1e-12){best=g;bestKey=apart;}
  }
  if(!best)break;
  field.push({id:`field-${k+1}`,x:+best.x.toFixed(5),y:+best.y.toFixed(5),label:'',kind:'composition',reason:'Halo: a point just outside the subject\'s edge that lets the net wrap the subject. It is not an image feature.',labelOffset:[best.x>.55?-60:22,-24],score:0});
 }
 field.sort((a,b)=>a.y-b.y||a.x-b.x).forEach((f,k)=>f.label=`halo.${String(k+1).padStart(2,'0')}`);
 const nodes=[...features,...field],space=n=>({x:n.x*W/M,y:n.y*H/M});
 const along=(a,b)=>{let sum=0,min=1;for(let k=0;k<=12;k++){const v=sAt(a.x+(b.x-a.x)*k/12,a.y+(b.y-a.y)*k/12);sum+=v;min=Math.min(min,v);}return {mean:sum/13,min};};
 const pct=v=>Math.round(v*100)+'%',edge=(a,b,reason,weight)=>({a:a.id,b:b.id,reason,weight:+weight.toFixed(4)});

 const constellation=subjectNet(nodes,W,H,M,dAt,hasSubject,true);
 // Structure: neighbouring features whose segment stays on salient pixels.
 const fp=features.map(space),ftree=new Set(spanningTree(fp).map(([i,j])=>edgeKey(features[i].id,features[j].id))),structure=[];
 for(let i=0;i<features.length;i++)for(let j=i+1;j<features.length;j++){
  const a=features[i],b=features[j],p=persistence(fp,i,j),backbone=ftree.has(edgeKey(a.id,b.id));
  if(!backbone&&p<2)continue;
  const s=along(a,b);if(s.min<(backbone?.2:.3))continue;
  structure.push(edge(a,b,`Neighbouring features joined across salient pixels (mean saliency ${pct(s.mean)}).`,.5*s.mean+(backbone?.4:.1*(p-1))));
 }
 // Pattern: same measured kind, similar colour and size; joined as short
 // similarity chains without crossings.
 const desc=n=>n.feature,pairs=[];
 for(let i=0;i<features.length;i++){
  const a=features[i],near=features.map((b,j)=>({b,j,d:Math.hypot(fp[i].x-fp[j].x,fp[i].y-fp[j].y)})).filter(o=>o.j!==i&&desc(o.b).type===desc(a).type&&desc(o.b).tone===desc(a).tone).sort((p,q)=>p.d-q.d||p.j-q.j).slice(0,6);
  for(const {b,j,d} of near){
   if(j<i&&pairs.some(p=>p.i===j&&p.j===i))continue;
   const [r1,g1,b1]=desc(a).rgb,[r2,g2,b2]=desc(b).rgb,colour=Math.hypot(r1-r2,g1-g2,b1-b2)/Math.sqrt(3),dist=colour+.05*Math.abs(desc(a).scale-desc(b).scale);
   if(dist<=.22&&d<=.45)pairs.push({a,b,i,j,dist,colour,cost:d*(1+4*dist)});
  }
 }
 pairs.sort((p,q)=>p.cost-q.cost||p.i-q.i||p.j-q.j);
 const parent=new Map(features.map(n=>[n.id,n.id])),find=v=>{while(parent.get(v)!==v)v=parent.get(v);return v;},pattern=[];
 for(const p of pairs){
  const ra=find(p.a.id),rb=find(p.b.id);if(ra===rb)continue;
  if(pattern.some(e=>{const x=features.find(n=>n.id===e.a),y=features.find(n=>n.id===e.b);return ![e.a,e.b].includes(p.a.id)&&![e.a,e.b].includes(p.b.id)&&segmentsCross(space(x),space(y),space(p.a),space(p.b));}))continue;
  parent.set(ra,rb);
  const kind=desc(p.a).type==='spot'?`${desc(p.a).tone} spots`:{corner:'corners',tip:'silhouette tips',core:'region centres'}[desc(p.a).type];
  pattern.push(edge(p.a,p.b,`Both ${kind}${p.a.feature.scale===p.b.feature.scale?' of similar size':''}; colour differs by ${pct(p.colour)}.`,1-p.dist/.22*.7));
 }
 const subject=features.length>1;
 return {version:1,id:identity,title:'Your image / feature study',subtitle:'Marks, contours, tips and focus points on the subject',
  analysis:{version:FEATURE_ANALYSIS_VERSION,sourceSha256:identity.replace('upload-',''),type:'local-feature-proposal'},image,nodes,
  networks:{
   constellation:{title:'Constellation',meaning:'Links neighbouring points (no other point inside the circle spanning a pair) only where the line stays on the subject or just around its edge; separate parts are joined by the shortest bridges. Composition, not measurement.',edges:constellation},
   structure:{title:'Salient structure',meaning:subject?'Links neighbouring features whose connecting segment stays on high-saliency pixels: an outline of what stands out, not an anatomical model.':'No strong features were found, so there is no structure to trace.',edges:subject?structure:[]},
   pattern:{title:'Similar features',meaning:'Links features of the same measured kind (light spot, dark spot, corner, tip) with similar colour and size. Similar appearance is the rule; it does not imply the same object.',edges:pattern}
  },
  // The rule set behind every label and link, carried with the scene.
  rules:{roles:[
   {role:'focus',rule:'The centre of the most salient region.'},
   {role:'tip',rule:'An outermost point of the subject\'s silhouette.'},
   {role:'mark',rule:'A distinct light or dark spot on the subject.'},
   {role:'contour',rule:'A sharp turn where the outline or pattern changes direction.'},
   {role:'halo',rule:'A point just outside the subject\'s edge so the net can wrap it.'}],
   link:'Neighbours with no other point inside the circle spanning them, kept only where the line stays on the subject or just around its edge; separate parts join by the shortest bridge.'},
  focus:[...new Set(features.filter(n=>n.feature.type==='core').concat(features).map(n=>n.id))].slice(0,3),observations:[]};
}
