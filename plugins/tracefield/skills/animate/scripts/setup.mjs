// Self-contained bootstrap; git/npm are the only external requirements.
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const options={};
for(let i=2;i<process.argv.length;i++){
 const flag=process.argv[i];
 if(!['--lab','--repository','--revision'].includes(flag)||!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw new Error('Usage: node setup.mjs [--lab directory] [--repository URL] [--revision tag-or-SHA]');
 options[flag.slice(2)]=process.argv[++i];
}
if(Number(process.versions.node.split('.')[0])<24)throw new Error('Tracefield requires Node 24 or newer.');
const lab=path.resolve(options.lab||process.env.TRACEFIELD_LAB||path.join(homedir(),'tracefield-lab'));
const repository=options.repository||'https://github.com/rishi222k/tracefield.git';
const revision=options.revision||'v0.1.0';
if(revision.startsWith('-')||repository.startsWith('-'))throw new Error('Invalid repository or revision.');
const git=(args,cwd)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
git(['--version']);
if(!existsSync(path.join(lab,'.git'))){
 if(existsSync(lab))throw new Error(`Refusing to overwrite existing directory ${lab}. Choose --lab with a new path.`);
 await mkdir(path.dirname(lab),{recursive:true});
 // Clone to a staging directory so an interrupted install does not become a
 // seemingly valid runtime. A SHA fetch works for local and HTTPS remotes.
 const stage=lab+'.installing';
 if(existsSync(stage))throw new Error(`An unfinished setup exists at ${stage}. Inspect it before retrying.`);
 git(['init',stage]);git(['remote','add','origin',repository],stage);
 try{git(['fetch','--depth','1','origin',revision],stage);}catch{
  throw new Error(`Could not fetch ${revision}. The release may not be published yet. Inspect ${stage}; no existing lab was changed.`);
 }
 git(['checkout','--detach','FETCH_HEAD'],stage);
 const {rename}=await import('node:fs/promises');await rename(stage,lab);
}
const origin=git(['remote','get-url','origin'],lab);
if(origin!==repository)throw new Error('This lab belongs to a different repository. Choose a fresh --lab directory.');
const head=git(['rev-parse','HEAD'],lab);
let expected;
try{expected=git(['rev-parse',`${revision}^{commit}`],lab);}catch{
 const refs=git(['ls-remote','origin',revision,`refs/tags/${revision}`,`refs/tags/${revision}^{}`],lab).split('\n').filter(Boolean);
 expected=(refs.find(x=>x.endsWith('^{}'))||refs[0]||'').split(/\s+/)[0];
 if(!expected&&/^[a-f0-9]{40}$/.test(revision))expected=revision;
}
if(head!==expected)throw new Error(`Existing lab is at ${head}, not ${revision}. It was preserved; use a fresh directory for another release.`);
const packageData=JSON.parse(await readFile(path.join(lab,'package.json'),'utf8'));
if(packageData.name!=='tracefield')throw new Error('The selected revision is not a Tracefield runtime.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const lockHash=hash(await readFile(path.join(lab,'package-lock.json'))),stateFile=path.join(lab,'.tracefield-runtime.json');
let previous;try{previous=JSON.parse(await readFile(stateFile,'utf8'));}catch{}
if(!existsSync(path.join(lab,'node_modules'))||previous?.lockHash!==lockHash){
 execFileSync(process.platform==='win32'?'npm.cmd':'npm',['ci','--no-audit','--no-fund'],{cwd:lab,stdio:'inherit',shell:process.platform==='win32'});
}
await writeFile(stateFile,JSON.stringify({repository,revision,head,lockHash},null,2)+'\n');
console.log(JSON.stringify({lab,revision,head,reused:!!previous}));
