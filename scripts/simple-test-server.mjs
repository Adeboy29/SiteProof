import {spawn} from 'node:child_process';
const port='3102';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',port],{stdio:['ignore','pipe','pipe'],windowsHide:true});
server.stderr.pipe(process.stderr);
let started=false;
server.stdout.on('data',chunk=>{
 process.stdout.write(chunk);
 if(!started&&chunk.toString().includes('Ready')){
  started=true;
  const test=spawn(process.execPath,['scripts/simple-live-test.mjs'],{stdio:'inherit',windowsHide:true,env:{...process.env,SITEPROOF_URL:'http://127.0.0.1:'+port}});
  test.on('exit',code=>{server.kill();process.exitCode=code||0;});
 }
});
process.on('SIGINT',()=>server.kill());
