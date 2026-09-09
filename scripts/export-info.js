const fs = require('node:fs');
const path = require('node:path');
const w = require('../miniprogram/wedding');
const out = path.join(__dirname, '../exports'); fs.mkdirSync(out,{recursive:true});
const escape = text => text.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
const start = new Date(`${w.date}T${w.ceremonyTime}:00+08:00`).toISOString().replace(/[-:]/g,'').replace('.000Z','Z');
const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Liangchen//Wedding Invitation//ZH','CALSCALE:GREGORIAN','BEGIN:VEVENT',`UID:${w.date}-wedding@liangchen.local`,'DTSTAMP:20260908T000000Z',`DTSTART:${start}`,`SUMMARY:${escape(`${w.groom}与${w.bride}的婚礼`)}`,`LOCATION:${escape([w.venue.district,w.venue.address,w.venue.fullName,w.venue.room].join(' '))}`,`DESCRIPTION:${escape(`请于${w.guestArrivalTime}前到场，${w.ceremonyTime}婚礼典礼开始。${w.venue.room}。期待与你，一起见证幸福。`)}`,'END:VEVENT','END:VCALENDAR'];
// RFC 5545: fold at <= 75 UTF-8 bytes without splitting code points.
const fold = line => {let result='',chunk='';for(const char of line){if(Buffer.byteLength(chunk+char)>73){result+=chunk+'\r\n ';chunk='';}chunk+=char;}return result+chunk;};
fs.writeFileSync(path.join(out,'婚礼日程.ics'),lines.map(fold).join('\r\n')+'\r\n');
fs.writeFileSync(path.join(out,'微信邀请文案.txt'),`我们结婚啦！\n\n${w.groom} & ${w.bride}\n诚邀你在${w.dateLabel} ${w.ceremonyTime}，来见证我们的婚礼。\n请于${w.guestArrivalTime}前到场。\n${w.venue.district} · ${w.venue.fullName} · ${w.venue.room}\n\n带着祝福来，就很好。\n`);
fs.writeFileSync(path.join(out,'婚礼流程与筹备提醒.txt'),`${w.dateLabel} · ${w.groom}与${w.bride}的婚礼\n宾客请于${w.guestArrivalTime}前到场，${w.ceremonyTime}典礼开始。\n${w.venue.fullName} · ${w.venue.room}\n\n` + w.schedule.map(phase => phase.title+'\n'+phase.events.map(event=>event.time+(event.end?'—'+event.end:'')+(event.timeNote||'')+' '+event.title+'\n'+event.detail).join('\n\n')).join('\n\n')+'\n\n筹备提醒（休息区及包间尚需与酒店确认）\n'+w.preparationNotes.map(note=>'· '+note).join('\n')+'\n');
console.log('已导出婚礼日程和微信文案');
