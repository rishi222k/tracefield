import {spawnSync} from 'node:child_process';
import {readdir,readFile} from 'node:fs/promises';
import {validateScene} from '../public/scene.js';
for(const name of await readdir(new URL('../public/',import.meta.url))) {
  if(!name.endsWith('.js'))continue;
  const result=spawnSync(process.execPath,['--check',new URL('../public/'+name,import.meta.url).pathname],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
for(const name of await readdir(new URL('../public/scenes/',import.meta.url)))if(name.endsWith('.json'))validateScene(JSON.parse(await readFile(new URL('../public/scenes/'+name,import.meta.url))));
for(const script of ['scripts/validate-skill.mjs','scripts/validate-library.mjs']){const check=spawnSync(process.execPath,[script],{stdio:'inherit'});if(check.status!==0)process.exit(check.status||1);}
const tests=(await readdir(new URL('../tests/',import.meta.url))).filter(n=>n.endsWith('.test.mjs')).map(n=>'tests/'+n);
const result=spawnSync(process.execPath,['--test',...tests],{stdio:'inherit'});
process.exit(result.status??1);
