import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const knowledge=JSON.parse(readFileSync('../block_knowledge.json','utf8'));
writeFileSync('web/block-knowledge.js','// Generated from block_knowledge.json by chat:build.\nexport default '+JSON.stringify(knowledge)+';\n');
await build({entryPoints:['chatgpt-entry.tsx'],outfile:'web/chatgpt-react.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'}});
execFileSync(process.execPath,['node_modules/@tailwindcss/cli/dist/index.mjs','-i','components/chatgpt-tailwind.css','-o','web/chatgpt-react.css','--minify'],{stdio:'inherit'});
