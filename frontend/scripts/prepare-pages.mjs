import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
const destination=resolve('.pages');
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
await cp(resolve('out'),destination,{recursive:true,filter:source=>!['admin.html','admin.txt','admin','admin-config.json'].includes(basename(source))});
console.log('Prepared GitHub Pages export without the S3 administration entry.');
