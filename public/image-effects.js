export const EFFECT_VERSION='negative-dark-field-v2';
const limit=v=>Math.max(0,Math.min(255,v));
// Styles drawn from a processed copy of the image rather than CSS filters.
export const PROCESSED_STYLES=Object.freeze(['xray','darkfield','blueprint']);

// Blueprint: a deep blue sheet with the image's edges drawn as fine light lines
// and a faint negative fill, like a technical drawing. Fixed pixel operations.
function blueprintPixels(rgba,width,height,amount){
 const n=width*height,lum=new Float32Array(n),soft=new Float32Array(n),out=new Uint8ClampedArray(rgba.length);
 for(let i=0;i<n;i++){const a=rgba[i*4+3]/255;lum[i]=((rgba[i*4]*2126+rgba[i*4+1]*7152+rgba[i*4+2]*722)/10000)*a+255*(1-a);}
 // 3x3 box blur so edges come from shapes, not sensor noise.
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let s=0,c=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const yy=y+dy,xx=x+dx;if(yy>=0&&yy<height&&xx>=0&&xx<width){s+=lum[yy*width+xx];c++;}}soft[y*width+x]=s/c;}
 const gain=1/(18+70*(1-amount));
 const deep=[6,30,64],ink=[230,245,255];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const at=(xx,yy)=>soft[Math.min(height-1,Math.max(0,yy))*width+Math.min(width-1,Math.max(0,xx))];
  const gx=at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1)-at(x-1,y-1)-2*at(x-1,y)-at(x-1,y+1),gy=at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1)-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1);
  const edge=Math.min(1,Math.hypot(gx,gy)*gain/8),tone=(255-soft[y*width+x])/255,mix=Math.min(1,.03+.13*tone*amount+.9*Math.pow(edge,.85));
  const i=(y*width+x)*4;for(let c=0;c<3;c++)out[i+c]=Math.round(deep[c]+(ink[c]-deep[c])*mix);out[i+3]=255;
 }
 return out;
}

// Fixed, automatic pixel effects. No masks, model calls or per-image decisions.
export function transformPixels(rgba,width,height,intensity,style,surfaceTone=0){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4)throw new Error('Invalid pixel dimensions.');
 if(!Number.isFinite(surfaceTone)||surfaceTone<0||surfaceTone>100)throw new Error('Invalid surface tone amount.');
 if(!Number.isFinite(intensity)||intensity<0||intensity>100||!PROCESSED_STYLES.includes(style))throw new Error('Invalid image treatment.');
 if(style==='blueprint')return blueprintPixels(rgba,width,height,intensity/100);
 const out=new Uint8ClampedArray(rgba.length),luminance=new Float64Array(width*height),amount=intensity/100;
 for(let i=0;i<luminance.length;i++){const a=rgba[i*4+3]/255;const gray=(rgba[i*4]*2126+rgba[i*4+1]*7152+rgba[i*4+2]*722)/10000;luminance[i]=gray*a+255*(1-a);}
 let background=0,backgroundRG=0,backgroundBG=0;
 if(style==='darkfield'){
  const samples=[],reds=[],blues=[],step=Math.max(1,Math.floor(Math.min(width,height)/64));
  for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step)if(x<width*.05||x>=width*.95||y<height*.05||y>=height*.95){const i=(y*width+x)*4,a=rgba[i+3]/255;samples.push(luminance[y*width+x]);reds.push((rgba[i]-rgba[i+1])*a);blues.push((rgba[i+2]-rgba[i+1])*a);}
  samples.sort((a,b)=>a-b);background=samples[Math.floor(samples.length/2)];reds.sort((a,b)=>a-b);blues.sort((a,b)=>a-b);backgroundRG=reds[Math.floor(reds.length/2)];backgroundBG=blues[Math.floor(blues.length/2)];
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,gray=luminance[i];let value;
  if(style==='xray')value=limit((255-gray-127.5)*(1+amount*1.3)+127.5);
  else{
   const neighbor=(luminance[y*width+Math.max(0,x-2)]+luminance[y*width+Math.min(width-1,x+2)]+luminance[Math.max(0,y-2)*width+x]+luminance[Math.min(height-1,y+2)*width+x])/4;
   const detail=Math.abs(gray-neighbor),tonalDistance=Math.max(0,Math.abs(gray-background)-23);
   value=255*Math.pow(limit((tonalDistance*2.1+detail*7)*amount)/255,1.55);
   if(surfaceTone){
    const a=rgba[i*4+3]/255,rg=(rgba[i*4]-rgba[i*4+1])*a,bg=(rgba[i*4+2]-rgba[i*4+1])*a;
    const chroma=Math.hypot(rg-backgroundRG,bg-backgroundBG),u=Math.max(0,Math.min(1,(chroma-18)/90)),weight=u*u*(3-2*u);
    const negative=limit((255-gray-127.5)*(1+amount*1.3)+127.5),surface=negative*weight*surfaceTone/100;
    // Screen a continuous photographic layer into the original luminous effect.
    value=255-(255-value)*(255-surface)/255;
   }
  }
  out[i*4]=out[i*4+1]=out[i*4+2]=Math.round(value);out[i*4+3]=255;
 }
 return out;
}
