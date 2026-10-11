export const ANALYSIS_VERSION='contrast-proposal-v1';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const compareId=(a,b)=>a<b?-1:a>b?1:0;
const edge=(a,b,reason)=>({a:a.id,b:b.id,reason});

// Fixed sampling, explicit tie-breaks and no randomness. Proposes visual features;
// semantic interpretation can replace this saved scene in the separate agent step.
export function analyzePixels(rgba,width,height,identity,image){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4)throw new Error('Invalid analysis pixels.');
 const sw=Math.min(384,width),sh=Math.max(1,Math.round(height*sw/width));
 const gray=new Uint16Array(sw*sh);
 for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
  const sx=Math.min(width-1,Math.floor((x+.5)*width/sw)),sy=Math.min(height-1,Math.floor((y+.5)*height/sh)),i=(sy*width+sx)*4;
  const value=((rgba[i]*2126+rgba[i+1]*7152+rgba[i+2]*722)/10000)*(rgba[i+3]/255)+255*(1-rgba[i+3]/255);
  gray[y*sw+x]=Math.round(value/4)*4;
 }
 const candidates=[],cell=Math.max(8,Math.round(sw/18));
 for(let cy=2;cy<sh-2;cy+=cell)for(let cx=2;cx<sw-2;cx+=cell){
  let best;
  for(let y=cy;y<Math.min(sh-2,cy+cell);y+=2)for(let x=cx;x<Math.min(sw-2,cx+cell);x+=2){
   const i=y*sw+x,gx=Math.abs(gray[i+2]-gray[i-2]),gy=Math.abs(gray[i+sw*2]-gray[i-sw*2]);
   const lap=Math.abs(4*gray[i]-gray[i-1]-gray[i+1]-gray[i-sw]-gray[i+sw]);
   const score=Math.min(gx,gy)*2+Math.max(gx,gy)+lap*.5;
   if(!best||score>best.score)best={x:(x+.5)/sw,y:(y+.5)/sh,score,tone:gray[i],pixel:i};
  }
  if(best&&best.score>=32)candidates.push(best);
 }
 candidates.sort((a,b)=>b.score-a.score||a.pixel-b.pixel);
 const chosen=[];
 for(const p of candidates){if(chosen.every(q=>distance(p,q)>.055)){chosen.push(p);if(chosen.length===24)break;}}
 chosen.sort((a,b)=>a.y-b.y||a.x-b.x);
 const features=chosen.map((p,i)=>({id:`feature-${i+1}`,x:p.x,y:p.y,label:`feature.${String(i+1).padStart(2,'0')}`,kind:'observation',reason:'A local contrast feature from the fixed image proposal algorithm; no semantic object identity is inferred.',labelOffset:[i%2?28:-100,i%3?-24:24],tone:p.tone}));
 const frame=[[.12,.08],[.58,.07],[.9,.2],[.88,.82],[.62,.92],[.1,.85]].map(([x,y],i)=>({id:`field-${i+1}`,x,y,label:`field.${String(i+1).padStart(2,'0')}`,kind:'composition',reason:'A fixed compositional anchor. It is not a detected image feature.',labelOffset:[20,-25]}));
 const nodes=[...features,...frame],constellation=[];
 const seen=new Set();
 for(const a of nodes){const nearest=nodes.filter(b=>b!==a).sort((b,c)=>distance(a,b)-distance(a,c)||compareId(b.id,c.id)).slice(0,2);for(const b of nearest){const key=[a.id,b.id].sort().join(':');if(!seen.has(key)){seen.add(key);constellation.push(edge(a,b,'A proximity-based compositional connection between saved points.'));}}}
 const subject=features.length>1?features:frame,structure=[],used=new Set([subject[0]?.id]);
 while(used.size<subject.length){let best;for(const a of subject.filter(n=>used.has(n.id)))for(const b of subject.filter(n=>!used.has(n.id))){const d=distance(a,b);if(!best||d<best.d)best={a,b,d};}if(!best)break;structure.push(edge(best.a,best.b,'A minimum-length geometric backbone, not an anatomical relationship.'));used.add(best.b.id);}
 const pattern=[];const patternSeen=new Set();
 for(const a of features){const matches=features.filter(b=>b!==a).sort((b,c)=>(Math.abs(a.tone-b.tone)+distance(a,b)*15)-(Math.abs(a.tone-c.tone)+distance(a,c)*15)||compareId(b.id,c.id)).slice(0,1);for(const b of matches){const key=[a.id,b.id].sort().join(':');if(!patternSeen.has(key)){patternSeen.add(key);pattern.push(edge(a,b,'Similarity in sampled monochrome appearance, not semantic equivalence.'));}}}
 const networks={
  constellation:{title:'Constellation',meaning:'A proximity composition over contrast features and fixed frame points. These connections create visual rhythm.',edges:constellation},
  structure:{title:'Geometric structure',meaning:features.length>1?'A minimum-length backbone linking the saved contrast points. This is a geometric proposal, not an anatomical analysis.':'No strong feature structure was found; this backbone joins compositional points only.',edges:structure},
  pattern:{title:'Tone similarity',meaning:'Connections compare sampled monochrome appearance. They do not identify objects or infer meaning.',edges:pattern}
 };
 return {version:1,id:identity,title:'Your image / feature study',subtitle:'A deterministic feature proposal, ready for visual exploration',analysis:{version:ANALYSIS_VERSION,sourceSha256:identity.replace('upload-',''),type:'local-feature-proposal'},image,nodes,networks,focus:features.slice(0,3).map(n=>n.id),observations:[]};
}
