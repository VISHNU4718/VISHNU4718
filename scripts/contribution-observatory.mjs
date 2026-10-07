import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function render(calendar,dark=true){
 const days=calendar.weeks.flatMap(w=>w.contributionDays);
 if(!days.length)throw Error('Empty calendar');
 const sum=days.reduce((n,d)=>n+d.contributionCount,0);
 if(sum!==calendar.totalContributions)throw Error('Contribution totals do not match');
 const levels={NONE:0,FIRST_QUARTILE:1,SECOND_QUARTILE:2,THIRD_QUARTILE:3,FOURTH_QUARTILE:4};
 const bg=dark?'#111b2c':'#f5f8fb',ink=dark?'#e5edf7':'#24374b',muted=dark?'#96abc5':'#5b6d83';
 const colours=dark?['#24334a','#315d66','#488b8d','#72bdb4','#a3e0d4']:['#dce5ef','#bfdedb','#85bfb9','#448e8c','#235e62'];
 const date=s=>new Date(s+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const n=calendar.weeks.length,step=Math.min(18,940/n),left=112,top=142;
 let cells='',months='',last='';
 calendar.weeks.forEach((w,col)=>{
  const month=w.contributionDays[0].date.slice(0,7);
  if(month!==last){last=month;months+='<text x="'+(left+col*step)+'" y="122">'+new Date(w.contributionDays[0].date+'T00:00:00Z').toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'})+'</text>';}
  w.contributionDays.forEach(day=>{
   const row=new Date(day.date+'T00:00:00Z').getUTCDay(),level=levels[day.contributionLevel];
   if(level===undefined||day.contributionCount<0)throw Error('Invalid contribution');
   const x=left+col*step,y=top+row*18;
   cells+='<circle cx="'+x+'" cy="'+y+'" r="'+(level?5.8:3.2)+'" fill="'+colours[level]+'"><title>'+day.date+': '+day.contributionCount+' contributions</title></circle>';
   if(level)cells+='<circle class="glint" style="animation-delay:-'+(col*.23+row*.12).toFixed(2)+'s" cx="'+x+'" cy="'+y+'" r="8.4" fill="none" stroke="'+colours[level]+'" stroke-width=".8"/>';
  });
 });
 const totals=calendar.weeks.map(w=>w.contributionDays.reduce((s,d)=>s+d.contributionCount,0)),max=Math.max(...totals,1);
 let bars='';
 totals.forEach((value,col)=>{const h=value/max*42;bars+='<rect x="'+(left+col*step-5)+'" y="'+(329-h)+'" width="10" height="'+Math.max(h,1)+'" rx="2" fill="'+(value?colours[3]:colours[0])+'"><title>Week starting '+calendar.weeks[col].firstDay+': '+value+' contributions</title></rect>';});
 const active=days.filter(d=>d.contributionCount>0).length;
 return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="410" viewBox="0 0 1200 410" role="img" aria-label="Contribution Observatory. '+sum+' contributions from '+days[0].date+' to '+days.at(-1).date+'.">'+
 '<defs><linearGradient id="scan"><stop stop-color="#8edbca" stop-opacity="0"/><stop offset="1" stop-color="#8edbca" stop-opacity=".12"/></linearGradient><clipPath id="calendar"><rect x="100" y="132" width="960" height="127"/></clipPath></defs>'+
 '<style>text{font-family:Segoe UI,Arial,sans-serif;fill:'+ink+'}.small{font-size:13px;fill:'+muted+'}@keyframes sweep{from{transform:translateX(-160px)}to{transform:translateX(1000px)}}@keyframes glint{0%,80%,100%{opacity:.12}90%{opacity:.6}}.scan{animation:sweep 12s linear infinite}.glint{animation:glint 7s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.scan,.glint{animation:none}.scan{display:none}}</style>'+
 '<rect width="1200" height="410" rx="18" fill="'+bg+'"/><rect x="38" y="38" width="4" height="25" rx="2" fill="'+colours[4]+'"/>'+
 '<text x="54" y="57" font-size="22" font-weight="600">Contribution Observatory</text><text x="1147" y="57" font-size="20" text-anchor="end" font-weight="600">'+sum+' contributions</text>'+
 '<text class="small" x="54" y="86">'+date(days[0].date)+' — '+date(days.at(-1).date)+'</text><text class="small" x="1147" y="86" text-anchor="end">'+active+' active days · GitHub calendar</text>'+
 '<g class="small" font-size="13">'+months+'<text x="53" y="165">Mon</text><text x="53" y="201">Wed</text><text x="53" y="237">Fri</text></g>'+cells+
 '<g clip-path="url(#calendar)"><rect class="scan" x="100" y="132" width="140" height="127" fill="url(#scan)"/></g>'+
 '<path d="M105 273H1064" stroke="'+colours[0]+'"/><text class="small" x="53" y="305">Weekly</text><text class="small" x="53" y="323">activity</text>'+bars+
 '<text class="small" x="54" y="375">Each dot is one day. Height below = weekly total. Activity remains visible during animation.</text>'+
 '<g transform="translate(922 365)"><text class="small" x="0" y="10">Less</text>'+colours.map((c,i)=>'<circle cx="'+(46+i*18)+'" cy="6" r="5" fill="'+c+'"/>').join('')+'<text class="small" x="139" y="10">More</text></g></svg>';
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
 for(const [name,dark] of [['contribution-observatory.svg',false],['contribution-observatory-dark.svg',true]]){
 const content=render(calendar,dark);fs.writeFileSync('dist/'+name,content);
 if(process.env.CALENDAR_FIXTURE)continue;
 const url='https://api.github.com/repos/'+process.env.REPOSITORY+'/contents/assets/'+name;
 const headers={Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','Content-Type':'application/json'};
 const old=await fetch(url,{headers});let sha;
 if(old.ok)sha=(await old.json()).sha;else if(old.status!==404)throw Error('Read failed '+old.status);
 const result=await fetch(url,{method:'PUT',headers,body:JSON.stringify({message:'Refresh contribution observatory [skip ci]',content:Buffer.from(content).toString('base64'),...(sha?{sha}:{})})});
 if(!result.ok)throw Error('Publish failed '+result.status);
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exit(1)});
