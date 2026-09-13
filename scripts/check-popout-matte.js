'use strict';
// Optional media acceptance check: requires ffmpeg, no Python/model dependencies.
// Decode the shipped matte plane rather than testing a mask-cleanup implementation.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const wedding=require('../miniprogram/wedding');
const file=path.resolve(process.argv[2]||path.join(root,'web',wedding.coupleMotion.webPopoutFile));
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/popout-matte.json'),'utf8'));
const [width,height]=fixture.size,frameBytes=width*height;
const result=spawnSync('ffmpeg',['-v','error','-i',file,'-vf',`crop=${width}:${height}:${width}:0,format=gray`,'-f','rawvideo','pipe:1'],{maxBuffer:frameBytes*(fixture.frames+1)});
if(result.error)throw result.error;
if(result.status!==0)throw Error(result.stderr.toString());
if(result.stdout.length!==frameBytes*fixture.frames)throw Error('Unexpected decoded frame count');
let failed=false;
const report=fixture.regions.map(region=>{
  const [x,y,w,h]=region.rect,values=[];
  for(let frame=region.frames[0];frame<=region.frames[1];frame++){
    let sum=0;const offset=(frame-1)*frameBytes;
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)sum+=result.stdout[offset+yy*width+xx];
    values.push(sum/(w*h*255));
  }
  const min=Math.min(...values),max=Math.max(...values);
  const pass=(region.minMean===undefined||min>=region.minMean)&&(region.maxMean===undefined||max<=region.maxMean);
  failed ||= !pass;
  return {name:region.name,pass,minMean:+min.toFixed(4),maxMean:+max.toFixed(4),frames:values.length};
});
console.log(JSON.stringify({file,decodedFrames:fixture.frames,passed:!failed,regions:report},null,2));
process.exitCode=failed?1:0;
