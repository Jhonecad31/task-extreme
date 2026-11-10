import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),options={N:32768,r:8,p:1,maxmem:64*1024*1024};
export function validPassword(value){return typeof value==='string'&&value.length>=12&&value.length<=128}
export async function hashPassword(password){if(!validPassword(password))throw Error('La contraseña debe tener de 12 a 128 caracteres.');const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64,options);return `scrypt$32768$8$1$${salt}$${key.toString('hex')}`}
export async function verifyPassword(password,stored){if(typeof password!=='string'||password.length>128)return false;try{const [type,n,r,p,salt,hex]=stored.split('$');if(type!=='scrypt'||n!=='32768'||r!=='8'||p!=='1'||!/^[a-f0-9]{32}$/.test(salt)||!/^[a-f0-9]{128}$/.test(hex))return false;const key=await scrypt(password,salt,64,options);return timingSafeEqual(key,Buffer.from(hex,'hex'))}catch{return false}}
