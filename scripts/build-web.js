'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),esbuild=require('esbuild');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/h5');
async function copy(relative){const destination=path.join(out,relative);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.cp(path.join(root,relative),destination,{recursive:true,filter:source=>!source.endsWith('.DS_Store')});}
async function build(){
  await fs.rm(path.join(root,'web/vendor'),{recursive:true,force:true});
  await fs.mkdir(path.join(root,'web/vendor'),{recursive:true});
  // All paths are absolute; isolate npm resolution from unrelated parent Yarn PnP projects.
  await esbuild.build({absWorkingDir:os.tmpdir(),entryPoints:[path.join(root,'node_modules/@cloudbase/js-sdk/dist/index.esm.js')],outfile:path.join(root,'web/vendor/cloudbase.js'),bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,legalComments:'external',logLevel:'warning'});
  await esbuild.build({absWorkingDir:os.tmpdir(),entryPoints:[path.join(root,'web/journey-map.js')],nodePaths:[path.join(root,'node_modules')],outfile:path.join(root,'web/vendor/journey-map.js'),bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,legalComments:'external',logLevel:'warning'});
  await fs.copyFile(path.join(root,'node_modules/coordtransform/LICENSE'),path.join(root,'web/vendor/coordtransform-LICENSE.txt'));
  await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
  for(const file of ['index.html','poster.html','entry.js','entry.css','app.js','share.js','style.css','title-font.css','h5.css','cloud-client.js','popout.js','couple-motion.js','music.js','blessings.js','blessings.css'])await copy('web/'+file);
  const wedding=require('../miniprogram/wedding');
  // Ship only the configured H5 delivery copies, never their larger originals.
  // The reel is included in deployment but still requested after the opening.
  for(const file of [wedding.coupleMotion.webPopoutFile,wedding.coupleMotion.webFile,wedding.music.webFile].filter(Boolean)){
    if(!/^media\/[\w.-]+\.(mp4|mp3|m4a|ogg|wav)$/.test(file))throw Error('H5 media must be a local file inside web/media: '+file);
    await copy('web/'+file);
  }
  await copy('web/vendor');
  await copy('miniprogram/assets');
  await copy('miniprogram/shared/title-font-LICENSE.txt');
  for(const file of ['wedding.js','journey.js','shared/blessing-config.js','shared/blessing-editor.js','shared/blessing-snow.js','shared/rose-vines.js'])await copy('miniprogram/'+file);
  for(const file of ['婚礼日程.ics'])await copy('exports/'+file);
  await copy('favicon.ico');
  // Generate the shareable image from the same wedding content on every release.
  // Canvas, the font and QR encoder stay build-only; opening the H5 loads none of them.
  const {renderPoster,publicPath}=require('./render-poster');
  const poster=await renderPoster(wedding);
  await fs.mkdir(path.dirname(path.join(out,publicPath)),{recursive:true});
  await fs.writeFile(path.join(out,publicPath),poster);
  await fs.mkdir(path.join(root,'exports'),{recursive:true});
  await fs.writeFile(path.join(root,'exports/良辰之约-微信海报.jpg'),poster);
  // Existing visitors may cache JS/CSS for seven days. Version the built references
  // by their actual contents so every deployment loads matching code and config.
  async function versionResources(page){
    for(const match of [...page.matchAll(/((?:data-src|src|href)=["'])([^"']+(?:\.(?:js|css)|\/wedding-share-poster\.jpg))(["'])/g)]){
      const relative=match[2];if(/^(?:[a-z]+:|\/\/)/i.test(relative))continue;
      const file=path.resolve(out,'web',relative);
      if(!file.startsWith(out+path.sep))throw Error('Public resource outside bundle: '+relative);
      const version=createHash('sha256').update(await fs.readFile(file)).digest('hex').slice(0,12);
      page=page.replace(match[0],match[1]+relative+'?v='+version+match[3]);
    }
    return page;
  }
  const page=await versionResources(await fs.readFile(path.join(out,'web/index.html'),'utf8'));
  await fs.writeFile(path.join(out,'web/index.html'),page);
  await fs.writeFile(path.join(out,'web/poster.html'),await versionResources(await fs.readFile(path.join(out,'web/poster.html'),'utf8')));
  const shareHead=page.match(/<!-- Share preview:[\s\S]*?-->([\s\S]*?)<!-- \/Share preview -->/);
  if(!shareHead)throw new Error('Missing static H5 share metadata');
  // Link crawlers may not follow a JavaScript redirect. Give the root the same preview.
  await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+shareHead[1]+'<link rel="icon" href="./favicon.ico"></head><body><script>location.replace("./web/index.html"+location.search+location.hash)</script><a href="./web/index.html">打开婚礼请柬</a></body></html>\n');
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out,'404.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>良辰之约</title><p>这一页暂时找不到了。</p><a href="/">回到婚礼请柬</a></html>\n');
  console.log('H5 public bundle: '+out+' (cloud credentials, function sources, guest data and demos excluded)');
}
if(require.main===module)build().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build,out};
