import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
export async function ask(question,{hidden=false}={}){
 if(!process.stdin.isTTY)throw Error('Ejecuta este comando con una terminal interactiva. No envíes contraseñas en argumentos ni archivos.');
 let muted=false;const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback()}});
 const rl=createInterface({input:process.stdin,output,terminal:true});process.stdout.write(question);muted=hidden;
 try{return await rl.question('')}finally{rl.close();if(hidden)process.stdout.write('\n')}
}
