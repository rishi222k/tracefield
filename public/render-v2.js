import {visibleGraph, revealAt, clamp} from './scene.js';
import {transformPixels} from './image-effects.js';
import {overlayColors} from './settings.js';

const mono = '"Lab Mono", monospace';
function contrast(color){const hex=String(color).replace('#','');return /^[a-f0-9]{6}$/i.test(hex)&&parseInt(hex.slice(0,2),16)*.2126+parseInt(hex.slice(2,4),16)*.7152+parseInt(hex.slice(4,6),16)*.0722<128?'#f5f6ef':'#101816';}
function outlinedStroke(ctx){const color=ctx.strokeStyle,width=ctx.lineWidth;ctx.strokeStyle=contrast(color);ctx.lineWidth=width+Math.max(.8,width*1.6);ctx.stroke();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function outlinedRect(ctx,x,y,w,h){ctx.beginPath();ctx.rect(x,y,w,h);outlinedStroke(ctx);}
function segment(ctx, a,b,progress=1) { ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+(b.x-a.x)*progress,a.y+(b.y-a.y)*progress);outlinedStroke(ctx); }
function corners(ctx,x,y,size) {
  const r=size/2,l=size*.28;
  ctx.beginPath();
  for (const [sx,sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {ctx.moveTo(x+sx*r,y+sy*(r-l));ctx.lineTo(x+sx*r,y+sy*r);ctx.lineTo(x+sx*(r-l),y+sy*r);}
  outlinedStroke(ctx);
}
const overlaps=(a,b)=> a.x<b.x+b.w+7 && a.x+a.w+7>b.x && a.y<b.y+b.h+5 && a.y+a.h+5>b.y;

export function render(ctx, image, scene, settings, time, width, height, options={}) {
  settings={...settings,...overlayColors(settings)};
  const unit=options.unit || 1;
  ctx.save();ctx.clearRect(0,0,width,height);ctx.fillStyle='#171b1b';ctx.fillRect(0,0,width,height);
  const scale=Math.min(width/image.width,height/image.height);
  const w=image.width*scale,h=image.height*scale,x=(width-w)/2,y=(height-h)/2;
  const processed=['xray','darkfield'].includes(settings.imageStyle);
  ctx.save();ctx.filter=`grayscale(${settings.imageStyle==='original'?0:100}%) brightness(${processed?100:settings.exposure}%)`;
  ctx.drawImage(processed && options.xray?options.xray:image,x,y,w,h);ctx.restore();
  if(settings.preset==='blueprint'&&options.overlay!==false) {ctx.fillStyle='rgba(20,66,78,.27)';ctx.fillRect(x,y,w,h);}
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  const {edges,nodes}=visibleGraph(scene,settings);
  const t=((time % settings.duration)+settings.duration)%settings.duration;
  const nodeMap=new Map(nodes.map((n,i)=>[n.id,{...n,index:i, x:x+n.x*w+(n.kind==='composition'?Math.sin(t/settings.duration*Math.PI*2+i)*settings.drift*unit:0),y:y+n.y*h+(n.kind==='composition'?Math.cos(t/settings.duration*Math.PI*2+i)*settings.drift*unit:0)}]));
  const alpha=options.overlay===false?0:1;
  const opacity=settings.opacity/100*alpha;
  if(settings.grid>0 && alpha) {
    ctx.strokeStyle=settings.preset==='blueprint'?'#c8f1f2':'#ecebe3';ctx.globalAlpha=settings.grid/100*.28;ctx.lineWidth=.5*unit;
    const grid=48*unit;
    ctx.beginPath();for(let i=x;i<x+w;i+=grid){ctx.moveTo(i,y);ctx.lineTo(i,y+h);}for(let i=y;i<y+h;i+=grid){ctx.moveTo(x,i);ctx.lineTo(x+w,i);}ctx.stroke();
  }
  if(settings.motion==='scan' && alpha) {
    const scanY=y+h*(t/settings.duration);
    const g=ctx.createLinearGradient(0,scanY-70*unit,0,scanY);g.addColorStop(0,'transparent');g.addColorStop(1,settings.preset==='blueprint'?'rgba(158,220,228,.14)':'rgba(230,220,196,.10)');
    ctx.globalAlpha=1;ctx.fillStyle=g;ctx.fillRect(x,scanY-70*unit,w,70*unit);ctx.globalAlpha=.45;ctx.strokeStyle=settings.accent;ctx.lineWidth=.6*unit;segment(ctx,{x,y:scanY},{x:x+w,y:scanY});
  }
  edges.forEach((e,i)=>{
    const a=nodeMap.get(e.a),b=nodeMap.get(e.b);
    const progress=revealAt(t,i,edges.length,settings.motion,settings.duration);
    const selected=options.selected && (e.a===options.selected || e.b===options.selected);
    ctx.globalAlpha=opacity*(selected?1:['xray','darkfield'].includes(settings.imageStyle)?1:.72)*progress;
    ctx.strokeStyle=selected?settings.accent:settings.primary;ctx.lineWidth=settings.lineWidth*unit;
    ctx.setLineDash(settings.preset==='signal'?[3*unit,6*unit]:[]);segment(ctx,a,b,settings.motion==='acquire'?progress:1);ctx.setLineDash([]);
    if(settings.motion==='signal' && alpha) {
      const phase=((t/settings.duration*2 + i*.173)%1);
      const px=a.x+(b.x-a.x)*phase,py=a.y+(b.y-a.y)*phase;
      ctx.globalAlpha=.8*alpha;ctx.fillStyle=settings.accent;ctx.beginPath();ctx.arc(px,py,1.8*unit,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=.24*alpha;ctx.lineWidth=2*unit;ctx.strokeStyle=settings.accent;
      segment(ctx,{x:a.x+(b.x-a.x)*Math.max(0,phase-.06),y:a.y+(b.y-a.y)*Math.max(0,phase-.06)},{x:px,y:py});
    }
  });
  const hitTargets=[];
  nodes.forEach((n,i)=>{
    const p=nodeMap.get(n.id),progress=revealAt(t,i,nodes.length,settings.motion,settings.duration);
    const size=(settings.markerSize+(settings.motion==='acquire'?(1-progress)*26:0))*unit;
    const selected=options.selected===n.id;
    let nearScan=settings.motion==='scan'?Math.max(0,1-Math.abs(p.y-(y+h*t/settings.duration))/(h*.07)):0;
    const hash=((i+1)*2654435761+settings.seed*1013904223)>>>0;
    const highlighted=(hash%100)<settings.highlight;
    ctx.strokeStyle=selected||highlighted?settings.accent:settings.primary;ctx.globalAlpha=(.65+nearScan*.35)*progress*alpha;ctx.lineWidth=(selected?1.2:.85)*unit;
    const shape=settings.shape==='balanced'?['brackets','frames','dots'][hash%3]:settings.shape;
    if(shape==='frames'){outlinedRect(ctx,p.x-size/2,p.y-size/2,size,size);}
    else if(shape==='brackets')corners(ctx,p.x,p.y,size*(1+nearScan*.3));
    ctx.globalAlpha=.95*progress*alpha;ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(p.x,p.y,(selected?2.8:1.7)*unit,0,Math.PI*2);ctx.strokeStyle=contrast(ctx.fillStyle);ctx.lineWidth=1.4*unit;ctx.stroke();ctx.fill();
    hitTargets.push({id:n.id,x:p.x,y:p.y,r:Math.max(12*unit,size/2)});
  });
  const boxes=[];ctx.font=`${settings.fontSize*unit}px ${settings.font==='courier'?'"Lab Serif Mono",monospace':mono}`;
  if('letterSpacing' in ctx)ctx.letterSpacing=`${settings.fontSize*settings.letterSpacing/100*unit}px`;
  const labelNodes=nodes.filter((n,i)=> i<Math.ceil(nodes.length*settings.labels/100)||options.selected===n.id);
  labelNodes.forEach(n=>{
    const p=nodeMap.get(n.id),progress=revealAt(t,p.index,nodes.length,settings.motion,settings.duration);
    const bank=(settings.labelMode==='fashion'?'fabric.silk, drape.02, seam.detect, model.ref, look.14, ss26.png, texture.map, .hem, unmatched':settings.customLabels).split(',').map(s=>s.trim()).filter(Boolean);
    const label=settings.labelMode==='observed'?n.label:(bank[(p.index+settings.seed-1)%Math.max(1,bank.length)] || n.label).replaceAll('{n}',String(p.index+1).padStart(2,'0')).replaceAll('{coord}',`${Math.round(n.x*100)}:${Math.round(n.y*100)}`).replaceAll('{layer}',n.kind).replaceAll('{hex}',settings.accent);
    const tw=ctx.measureText(label).width,th=(settings.fontSize+1)*unit;
    const desired=n.labelOffset || [25,-25];
    const phase=(t/settings.duration*Math.PI*2)+p.index*1.37+settings.seed*.61;
    const travel=settings.labelMotion==='float'?settings.noteTravel*unit:0;
    const dx=desired[0]*unit+Math.sin(phase)*travel,dy=(desired[1]+((settings.seed-1)%3)*5)*unit+Math.cos(phase)*travel*.65;
    const candidates=[[dx,dy],[dx,dy-24*unit],[dx,dy+24*unit],[-dx-tw,dy],[22*unit,-44*unit],[-tw-24*unit,44*unit]];
    let box;
    for(const [cx,cy] of candidates) {
      const b={x:clamp(p.x+cx,x+10*unit,x+w-tw-10*unit),y:clamp(p.y+cy,y+12*unit,y+h-th-8*unit),w:tw,h:th};
      if(!settings.avoidOverlap||!boxes.some(z=>overlaps(b,z))){box=b;break;}
    }
    if(!box)return;boxes.push(box);
    const end={x:box.x+(box.x<p.x?tw:0),y:box.y+th*.5};
    const elbow={x:p.x+(end.x-p.x)*.45,y:end.y};
    ctx.strokeStyle=settings.primary;ctx.globalAlpha=.53*progress*alpha;ctx.lineWidth=.8*unit;ctx.setLineDash([1*unit,5*unit]);segment(ctx,p,elbow);segment(ctx,elbow,end);ctx.setLineDash([]);
    ctx.fillStyle=contrast(settings.primary)==='#f5f6ef'?'rgba(245,246,239,.88)':'rgba(12,19,17,.82)';ctx.globalAlpha=progress*alpha;ctx.fillRect(box.x-3*unit,box.y-2*unit,tw+6*unit,th+4*unit);
    ctx.fillStyle=settings.primary;ctx.globalAlpha=.94*progress*progress*alpha;ctx.textBaseline='top';
    const text=label;
    ctx.fillText(text,box.x,box.y);
  });
  if(settings.motion==='inspect' && alpha){
    const focus=(scene.focus || ['tip','origin','flower']).map(id=>nodeMap.get(id)).filter(Boolean);
    if(focus.length){
      const slot=settings.duration/focus.length,active=focus[Math.floor(t/slot)%focus.length];
      const local=(t%slot)/slot,fade=Math.min(1,local*9,(1-local)*9);
      const size=Math.min(112*unit,w*.27),roi=42*unit;
      const px=x+w-size-20*unit,py=y+30*unit;
      ctx.globalAlpha=fade*alpha;ctx.strokeStyle=settings.accent;ctx.lineWidth=.7*unit;
      segment(ctx,active,{x:px+size*.5,y:py+size});corners(ctx,active.x,active.y,roi);
      ctx.fillStyle=settings.imageStyle==='xray'?'#262a29':'#101511';ctx.fillRect(px-5*unit,py-5*unit,size+10*unit,size+33*unit);
      const crop=roi/scale*.7;
      const sx=clamp((active.x-x)/scale-crop/2,0,image.width-crop),sy=clamp((active.y-y)/scale-crop/2,0,image.height-crop);
      ctx.save();ctx.filter=settings.imageStyle==='original'?'none':`grayscale(100%) brightness(${processed?100:settings.exposure}%)`;
      ctx.drawImage(processed&&options.xray?options.xray:image,sx,sy,crop,crop,px,py,size,size);ctx.restore();
      outlinedRect(ctx,px,py,size,size);corners(ctx,px+size*.5,py+size*.5,19*unit);
      ctx.fillStyle=settings.primary;ctx.font=`${9*unit}px ${mono}`;ctx.textBaseline='top';ctx.fillText(active.label,px,py+size+8*unit);
      const anchor=scene.nodes.find(n=>n.id===active.id);
      ctx.fillStyle=settings.accent;ctx.font=`${7*unit}px ${mono}`;ctx.fillText(`${Math.round(anchor.x*1000)} / ${Math.round(anchor.y*1000)}`,px,py+size+21*unit);
    }
  }
  ctx.restore();ctx.restore();
  return {bounds:{x,y,w,h},hitTargets,nodes:nodes.length,edges:edges.length};
}

export function makeXray(image, intensity, style='xray',surfaceTone=0) {
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,c.width,c.height);
  pixels.data.set(transformPixels(pixels.data,c.width,c.height,intensity,style,surfaceTone));
  ctx.putImageData(pixels,0,0);return c;
}
