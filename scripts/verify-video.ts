// Browser verification: import this module in the Vite preview after exporting.
import {Input,ALL_FORMATS,BlobSource,EncodedPacketSink,CanvasSink} from 'mediabunny';
import {render} from '../public/render.js';
import {makeXray} from '../public/render.js';
import {render as renderV2} from '../public/render-v2.js';
export async function verifyVideo(result:any){
 const input=new Input({formats:ALL_FORMATS,source:new BlobSource(result.blob)});
 try{
  const track=await input.getPrimaryVideoTrack();if(!track)throw new Error('Export has no video track.');
  let count=0,first:any,last:any,maxGap=0,previous:any;
  for await(const packet of new EncodedPacketSink(track).packets()){if(!first)first=packet;if(previous)maxGap=Math.max(maxGap,Math.abs(packet.timestamp-(previous.timestamp+previous.duration)));last=packet;previous=packet;count++;}
  const duration=await input.computeDuration(),metrics=await track.computeFrameRateMetrics();
  const width=await track.getDisplayWidth(),height=await track.getDisplayHeight();
  const sink=new CanvasSink(track,{width:512});
  const firstFrame=await sink.getCanvas(0),endFrame=await sink.getCanvas(duration-1/metrics.bestGuessFrameRate);
  if(!firstFrame||!endFrame)throw new Error('Could not decode endpoint frames.');
  const img=new Image();img.src=result.project.scene.image.src;await img.decode();
  const settings=result.project.settings,fx=['xray','darkfield'].includes(settings.imageStyle)?makeXray(img,settings.xrayContrast,settings.imageStyle,settings.surfaceTone):null;
  const renderer=result.project.rendererVersion==='node-network-renderer-v2'?renderV2:render;
  const expected=document.createElement('canvas');expected.width=firstFrame.canvas.width;expected.height=firstFrame.canvas.height;
  const observed=document.createElement('canvas');observed.width=expected.width;observed.height=expected.height;observed.getContext('2d')!.drawImage(firstFrame.canvas,0,0);
  const actual=observed.getContext('2d')!.getImageData(0,0,expected.width,expected.height).data;
  function errorAt(time:number){renderer(expected.getContext('2d'),img,result.project.scene,settings,time,expected.width,expected.height,{unit:expected.width/560,xray:fx});const pixels=expected.getContext('2d')!.getImageData(0,0,expected.width,expected.height).data;let sum=0;for(let i=0;i<pixels.length;i+=4)sum+=Math.abs(pixels[i]-actual[i]);return sum/(pixels.length/4);}
  const firstFrameError=errorAt(0),middleFrameError=errorAt(settings.duration/2);
  observed.getContext('2d')!.drawImage(endFrame.canvas,0,0);const end=observed.getContext('2d')!.getImageData(0,0,expected.width,expected.height).data;let seam=0;for(let i=0;i<end.length;i+=4)seam+=Math.abs(end[i]-actual[i]);
  return {count,expectedFrames:result.frames,firstTimestamp:first.timestamp,firstKey:first.type,lastTimestamp:last.timestamp,lastDuration:last.duration,duration,expectedDuration:result.seconds,maxGap,frameRate:metrics.bestGuessFrameRate,width,height,firstFrameError,middleFrameError,endpointMeanDifference:seam/(end.length/4)};
 }finally{input.dispose();}
}
