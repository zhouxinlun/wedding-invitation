'use strict';
const {parseContext}=require('@cloudbase/node-sdk');

// Only the invocation context is trusted. Process-level user variables can belong
// to a previous caller when a function instance serves both WeChat and Web.
function requestIdentity(context){
  if(!context||typeof context!=='object')return {};
  try{
    const parsed=parseContext(context),current=parsed.environment||parsed.environ;
    if(!current||typeof current!=='object')return {};
    const text=value=>typeof value==='string'?value:'';
    return {
      OPENID:text(current.WX_OPENID),APPID:text(current.WX_APPID),
      WEB_UID:text(current.TCB_UUID),ENV:text(current.TCB_ENV)||text(parsed.namespace)
    };
  }catch(_){return {};}
}
module.exports={requestIdentity};
