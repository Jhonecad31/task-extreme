import {configuration} from './config.mjs';
import {createApplication} from './application.mjs';
import {createHttpServer} from './http-server.mjs';
process.umask(0o077);
const config=configuration(),app=await createApplication(config),server=createHttpServer(app,{origin:config.origin,trustProxy:process.env.TRUST_PROXY==='1'});
server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Task Extreme listo en '+config.origin));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.close(()=>{app.close();process.exit(0)});server.closeAllConnections();});
