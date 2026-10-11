// Check tracked files across all local Git history before publishing code.
import {execFileSync} from 'node:child_process';
const objects=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8'}).split('\n').map(line=>line.slice(41));
const tracked=execFileSync('git',['ls-files','--cached'],{encoding:'utf8'}).split('\n');
const unsafe=[...new Set([...objects,...tracked])].filter(file=>
 /(^|\/)(references|results|exports)\//.test(file)||
 /\.(png|jpe?g|webp|avif|gif|mp4|webm|mov)$/i.test(file)||
 (/^public\/library\//.test(file)&&!['public/library/index.json','public/library/.gitkeep'].includes(file)));
if(unsafe.length)throw new Error('Public history contains unapproved media or studies:\n'+unsafe.join('\n'));
console.log('Public Git history contains no demo photos, reference images, study bundles or exports.');
