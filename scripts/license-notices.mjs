import {readFile,readdir,writeFile} from 'node:fs/promises';
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
let output='# Third-party notices\n\nThe studio uses the following source-owned UI and bundled dependencies. Sample image provenance is documented separately in references.md.\n\n## shadcn/ui\n\nSource: https://github.com/shadcn-ui/ui\n\n'+await readFile('licenses/shadcn-MIT.txt','utf8');
for(const [dir,info] of Object.entries(lock.packages)){
 if(!dir.startsWith('node_modules/')||info.dev)continue;
 const pkg=JSON.parse(await readFile(dir+'/package.json','utf8'));
 const files=(await readdir(dir)).filter(name=>/^licen[cs]e(?:\.|$)/i.test(name));
 output+='\n\n## '+pkg.name+' '+pkg.version+'\n\n';
 if(files.length)for(const file of files)output+=await readFile(dir+'/'+file,'utf8')+'\n';
 else output+='License: '+pkg.license+'. Source: '+(typeof pkg.repository==='string'?pkg.repository:pkg.repository?.url||pkg.homepage||'https://www.npmjs.com/package/'+pkg.name)+'\n';
}
await writeFile('THIRD_PARTY_NOTICES.md',output);
