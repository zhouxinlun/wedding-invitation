'use strict';
const http=require('node:http'),https=require('node:https'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist/h5'),port=Number(process.env.PORT||8765);
const types={'.mp4':'video/mp4','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.wav':'audio/wav','.ico':'image/x-icon','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.ics':'text/calendar; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  // Reuse the deployed, fixed-host AMap proxy. No security secret on developers' machines.
  if(request.url.startsWith('/_AMapService/')){
    const upstream=https.request({hostname:'xinni1006.mengmeng.site',path:request.url,method:request.method,timeout:12000,
      headers:{referer:'https://xinni1006.mengmeng.site/'}},incoming=>{
      response.writeHead(incoming.statusCode,{'Content-Type':incoming.headers['content-type']||'application/octet-stream','Cache-Control':'no-store'});
      incoming.pipe(response);
    });
    upstream.on('timeout',()=>upstream.destroy());
    upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end('Map service unavailable');});
    upstream.end();return;
  }
  let file;try{const url=new URL(request.url,'http://localhost');file=path.resolve(root,'.'+decodeURIComponent(url.pathname));}catch(_){response.writeHead(400);response.end();return;}
  if(file!==root&&!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  if(file===root||request.url.split('?')[0].endsWith('/'))file=path.join(file,'index.html');
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){response.writeHead(404);response.end('Not found');return;}
    response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});
    if(request.method==='HEAD'){response.end();return;}fs.createReadStream(file).pipe(response);
  });
});
server.listen(port,'127.0.0.1',()=>console.log('H5 development: http://127.0.0.1:'+port+'/ (serves public bundle only)'));
