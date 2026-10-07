import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function render(calendar){
 const days=calendar.weeks.flatMap(w=>w.contributionDays);
 if(!days.length||days.reduce((s,d)=>s+d.contributionCount,0)!==calendar.totalContributions)throw Error('Invalid contribution calendar');
 let grid='<g><text x="22" y="133" font-size="11">Mon</text><text x="22" y="183" font-size="11">Wed</text><text x="22" y="233" font-size="11">Fri</text>',last='',active=[],flowers='';
 calendar.weeks.forEach((week,col)=>week.contributionDays.forEach(d=>{
  if(!Number.isInteger(d.contributionCount)||d.contributionCount<0)throw Error('Invalid day count');
  const dt=new Date(d.date+'T00:00:00Z'),x=70+col*20,y=105+dt.getUTCDay()*25,month=d.date.slice(0,7);
  if(month!==last){last=month;grid+='<text x="'+x+'" y="77">'+dt.toLocaleDateString('en',{month:'short',timeZone:'UTC'})+'</text>';}
  let body='<title>'+d.date+': '+d.contributionCount+' contributions</title><ellipse cx="'+x+'" cy="'+(y+6)+'" rx="5" ry="2" fill="#263d35"/>';
  if(d.contributionCount){
   const level=d.contributionCount<=3?1:d.contributionCount<=9?2:d.contributionCount<=19?3:4,colours=['','#8bbfd6','#b3a0df','#e2b8cb','#f0dca4'],radius=3.5+level*.65;
   active.push({x,y:y-5});
   body+='<path d="M'+x+' '+(y+5)+'v-8m0 6q-7 -7 -7 -3m7 1q7 -7 7 -3" fill="none" stroke="#83b394" stroke-width="1.3"/>';
   for(let n=0;n<5+level;n++){const a=n*Math.PI*2/(5+level);body+='<circle cx="'+(x+Math.cos(a)*radius)+'" cy="'+(y-5+Math.sin(a)*radius)+'" r="2.5" fill="'+colours[level]+'"/>';}
   body+='<circle cx="'+x+'" cy="'+(y-5)+'" r="2.2" fill="#fff2cb"/>';
  }
  flowers+='<g'+(d.contributionCount?' class="flower'+active.length+'"':'')+'>'+body+'</g>';
 }));
 grid+='</g>'+flowers;
 const dock={x:1125,y:404},points=[dock,...active.map(p=>({x:p.x-25,y:p.y-12})),dock];
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 const total=lengths.at(-1)||1,kt=[0],kp=[0];let pour='0%{opacity:0}',tip='0%{transform:rotate(0deg)}',css='';
 for(let i=1;i<points.length;i++){
  const a=.9*(i-.42)/(points.length-1),b=.9*i/(points.length-1);
  kt.push(a,b);kp.push(lengths[i]/total,lengths[i]/total);
  if(i<=active.length){
   const aa=a*100,bb=b*100;
   pour+=aa.toFixed(3)+'%{opacity:0}'+(aa+.12).toFixed(3)+'%,'+(bb-.12).toFixed(3)+'%{opacity:1}'+bb.toFixed(3)+'%{opacity:0}';
   tip+=aa.toFixed(3)+'%{transform:rotate(0deg)}'+(aa+.12).toFixed(3)+'%,'+(bb-.12).toFixed(3)+'%{transform:rotate(-12deg)}'+bb.toFixed(3)+'%{transform:rotate(0deg)}';
   css+='@keyframes grow'+i+'{0%,'+aa.toFixed(3)+'%,'+(bb+.2).toFixed(3)+'%,100%{transform:scale(1)}'+(aa+.25).toFixed(3)+'%,'+(bb-.12).toFixed(3)+'%{transform:scale(1.16)}}.flower'+i+'{transform-origin:'+active[i-1].x+'px '+active[i-1].y+'px;animation:grow'+i+' 70s linear infinite;}';
  }
 }
 kt.push(1);kp.push(active.length?1:0);
 const motion='<g transform="translate(1125 404)"><g class="robot"><animateMotion dur="70s" repeatCount="indefinite" calcMode="linear" keyTimes="'+kt.join(';')+'" keyPoints="'+kp.join(';')+'" path="M'+points.map(p=>(p.x-dock.x)+' '+(p.y-dock.y)).join(' L')+'"/>';
 const raw=fs.readFileSync('assets/garden-template.svg','utf8');
 return raw.replace('{{GRID}}',grid).replace('{{MOTION}}',motion).replace('{{FLOWER_CSS}}',css).replace('{{ROBOT_CSS}}','@keyframes pour{'+pour+'100%{opacity:0}}@keyframes tip{'+tip+'100%{transform:rotate(0deg)}}').replaceAll('{{DATE_RANGE}}',days[0].date+' — '+days.at(-1).date).replaceAll('{{DATE_ARIA}}',days[0].date+' to '+days.at(-1).date);
}
async function main(){
 let calendar;
 if(process.env.CALENDAR_FIXTURE)calendar=JSON.parse(fs.readFileSync(process.env.CALENDAR_FIXTURE,'utf8'));
 else {
 const to=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Kolkata'}).format(new Date())+'T23:59:59+05:30';
 const r=await fetch('https://api.github.com/graphql',{method:'POST',headers:{Authorization:'Bearer '+process.env.GH_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({query:'query($to: DateTime!) { user(login: "VISHNU4718") { contributionsCollection(to: $to) { contributionCalendar { totalContributions weeks { firstDay contributionDays { date contributionCount contributionLevel } } } } } }',variables:{to}})});
 const data=await r.json();calendar=data.data?.user?.contributionsCollection?.contributionCalendar;
 if(!r.ok||data.errors||!calendar)throw Error('GitHub calendar unavailable; retaining previous assets');
 }
 fs.mkdirSync('dist',{recursive:true});
 for(const [name,dark] of [['contribution-garden.svg',true]]){
 const content=render(calendar,dark);fs.writeFileSync('dist/'+name,content);
 if(process.env.CALENDAR_FIXTURE)continue;
 const url='https://api.github.com/repos/'+process.env.REPOSITORY+'/contents/assets/'+name;
 const headers={Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'};
 const old=await fetch(url,{headers});let sha;
 if(old.ok)sha=(await old.json()).sha;else if(old.status!==404)throw Error('Read failed '+old.status);
 const result=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:'Refresh robot contribution garden [skip ci]',content:Buffer.from(content).toString('base64'),...(sha?{sha}:{})})});
 if(!result.ok)throw Error('Publish failed '+result.status);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1)});
