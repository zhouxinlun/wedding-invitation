'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist/h5');
async function copy(relative){const destination=path.join(out,relative);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.cp(path.join(root,relative),destination,{recursive:true,filter:source=>!source.endsWith('.DS_Store')});}
async function build(){
  await fs.mkdir(path.join(root,'web/vendor'),{recursive:true});
  // All paths are absolute; isolate npm resolution from unrelated parent Yarn PnP projects.
  await esbuild.build({absWorkingDir:os.tmpdir(),entryPoints:[path.join(root,'node_modules/@cloudbase/js-sdk/dist/index.esm.js')],outfile:path.join(root,'web/vendor/cloudbase.js'),bundle:true,format:'esm',platform:'browser',target:'es2020',minify:true,legalComments:'external',logLevel:'warning'});
  await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
  for(const file of ['index.html','app.js','style.css','title-font.css','h5.css','cloud-client.js','couple-motion.js','blessings.js','blessings.css'])await copy('web/'+file);
  await copy('web/vendor');
  await copy('miniprogram/assets');
  await copy('miniprogram/shared/title-font-LICENSE.txt');
  for(const file of ['wedding.js','journey.js','shared/blessing-config.js','shared/blessing-editor.js','shared/blessing-snow.js','shared/rose-vines.js'])await copy('miniprogram/'+file);
  for(const file of ['婚礼日程.ics','良辰之约-微信请柬.png'])await copy('exports/'+file);
  await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>良辰之约 · 婚礼请柬</title><meta name="viewport" content="width=device-width,initial-scale=1"><script>location.replace("./web/index.html"+location.search+location.hash)</script><a href="./web/index.html">打开婚礼请柬</a></html>\n');
  await fs.writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
  await fs.writeFile(path.join(out,'404.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>良辰之约</title><p>这一页暂时找不到了。</p><a href="/">回到婚礼请柬</a></html>\n');
  console.log('H5 public bundle: '+out+' (cloud credentials, function sources, guest data and demos excluded)');
}
if(require.main===module)build().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build,out};
