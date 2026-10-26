/* Palestre : logique de l'appli. Les données (aliments, séances…) sont dans data.js, chargé avant ce fichier. */
(function(){
'use strict';

/* ---------- Utilitaires ---------- */
function $(s){return document.querySelector(s)}
function fmt(n){return Math.round(n).toLocaleString('fr-FR')}
function fmt1(n){return (Math.round(n*10)/10).toLocaleString('fr-FR')}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function ds(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function todayStr(){return ds(new Date())}
function parse(s){var a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2])}
function addDays(s,n){var d=parse(s);d.setDate(d.getDate()+n);return ds(d)}
function dayLabel(s){var t=todayStr();if(s===t)return 'Aujourd’hui';if(s===addDays(t,-1))return 'Hier';return parse(s).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}
function num(v){var n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:NaN}

/* ---------- État ---------- */
/* La clé garde l'ancien nom pour ne pas perdre les données déjà enregistrées dans le navigateur. */
var LS='carnet-forme-v1';
var DEFAULT_BOTTLES=[{n:'Gourde 32 oz',ml:946},{n:'Gourde 600 ml',ml:600},{n:'Verre',ml:250}];
function defaultState(){return {profile:{age:31,height:170,sex:'f',startKg:75,goalKg:60,refSteps:8000,custom:[],recent:[],bottles:DEFAULT_BOTTLES.slice()},weights:[{d:todayStr(),kg:75}],days:{}}}
function emptyDay(){return {meals:{bk:[],lu:[],sn:[],di:[]},water:0,waterLog:[],steps:0,work:[],sleep:0,energy:0,hunger:0,hr:0}}
function normDay(o){var d=emptyDay();o=o||{};var m=o.meals||{};['bk','lu','sn','di'].forEach(function(k){d.meals[k]=Array.isArray(m[k])?m[k]:[]});d.water=+o.water||0;d.waterLog=Array.isArray(o.waterLog)?o.waterLog:[];d.steps=+o.steps||0;d.work=Array.isArray(o.work)?o.work:[];d.sleep=+o.sleep||0;d.energy=+o.energy||0;d.hunger=+o.hunger||0;d.hr=+o.hr||0;return d}
var S=defaultState(),lsLoaded=false;
try{var raw=localStorage.getItem(LS);if(raw){var o=JSON.parse(raw);if(o&&o.profile){S=o;lsLoaded=true;Object.keys(S.days||{}).forEach(function(k){S.days[k]=normDay(S.days[k])});S.profile.custom=S.profile.custom||[];S.profile.recent=S.profile.recent||[];if(!S.profile.bottles||!S.profile.bottles.length)S.profile.bottles=DEFAULT_BOTTLES.slice();if(!S.weights||!S.weights.length)S.weights=[{d:todayStr(),kg:S.profile.startKg}]}}}catch(e){}
S.days=S.days||{};

var ui={tab:'jour',date:todayStr(),sheet:null,prog:'A',profOpen:false};
var col=null,dirty=new Set(),flushing=false,timer=null,needProfileDoc=false,syncState='local';

function D(k){return S.days[k]||emptyDay()}
function W(k){if(!S.days[k])S.days[k]=emptyDay();return S.days[k]}
function saveLocal(){try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}}
function touch(k){
  dirty.add(k);if(needProfileDoc)dirty.add('profile');
  saveLocal();clearTimeout(timer);timer=setTimeout(flush,500);
}
function setSync(s){syncState=s;var el=$('#sync');if(el){el.className='sync '+(s==='db'?'db':'');el.innerHTML='<i></i>'+(s==='db'?'Enregistré':'Sur cet appareil')}}
async function flush(){
  if(flushing||!col)return;flushing=true;
  try{
    while(dirty.size){
      var k=dirty.values().next().value;dirty.delete(k);
      var data=k==='profile'?{profile:S.profile,weights:S.weights,v:1}:(S.days[k]||emptyDay());
      try{await col.doc(k==='profile'?'profile':'day-'+k).set(JSON.parse(JSON.stringify(data)));if(k==='profile')needProfileDoc=false}
      catch(e){dirty.add(k);setSync('local');return}
    }
    setSync('db');
  }finally{flushing=false}
}
async function initDb(){
  try{
    if(!window.claude||!window.claude.use){return}
    var res=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
    var db=res[0],user=res[1];
    if(!db||!user){setSync('local');return}
    var id=await user.id();
    if(!id){setSync('local');return}
    col=db.collection('data/users/'+id);
    var snap=await col.get();
    if(snap.empty){
      if(lsLoaded||Object.keys(S.days).length){dirty.add('profile');Object.keys(S.days).forEach(function(k){dirty.add(k)});flush()}
      else{needProfileDoc=true;setSync('db')}
      return;
    }
    var ns=defaultState();ns.days={};var hasProfile=false;
    snap.docs.forEach(function(doc){
      var d=JSON.parse(JSON.stringify(doc.data()||{}));
      if(doc.id==='profile'){hasProfile=true;if(d.profile)ns.profile=Object.assign(ns.profile,d.profile);if(Array.isArray(d.weights)&&d.weights.length)ns.weights=d.weights;ns.profile.custom=ns.profile.custom||[];ns.profile.recent=ns.profile.recent||[];if(!ns.profile.bottles||!ns.profile.bottles.length)ns.profile.bottles=DEFAULT_BOTTLES.slice()}
      else if(doc.id.indexOf('day-')===0){ns.days[doc.id.slice(4)]=normDay(d)}
    });
    if(!hasProfile)needProfileDoc=true;
    S=ns;saveLocal();setSync('db');render();
  }catch(e){setSync('local')}
}

/* ---------- Calculs ---------- */
function curKg(){var w=S.weights.slice().sort(function(a,b){return a.d<b.d?-1:1});return w.length?w[w.length-1].kg:S.profile.startKg}
function bmr(w){var p=S.profile;return 10*w+6.25*p.height-5*p.age+(p.sex==='m'?5:-161)}
function calc(k){
  var w=curKg(),p=S.profile,d=D(k);
  var base=bmr(w)*1.2,kp=w*0.0004;
  var refBurn=base+p.refSteps*kp;
  var target=Math.max(1200,Math.round((refBurn-450)/50)*50);
  var eaten=0,prot=0;
  MEALS.forEach(function(m){d.meals[m[0]].forEach(function(i){eaten+=i.k*i.q;prot+=(i.p||0)*i.q})});
  var stepK=d.steps*kp,workK=d.work.reduce(function(a,x){return a+x.kcal},0);
  var burn=base+stepK+workK;
  var extra=Math.max(0,(d.steps-p.refSteps)*kp)+workK;
  var bonus=Math.round(extra*0.5),budget=target+bonus;
  return {w:w,base:base,kp:kp,refBurn:refBurn,target:target,eaten:eaten,prot:prot,stepK:stepK,workK:workK,burn:burn,bonus:bonus,budget:budget,left:budget-eaten,deficit:burn-eaten,protT:Math.max(50,Math.round(1.4*w/5)*5),waterT:2000};
}

/* ---------- Conseils du jour ---------- */
function advice(k,c){
  var d=D(k),out=[],isToday=k===todayStr(),h=isToday?new Date().getHours():24;
  var any=c.eaten>0;
  if(!any&&h<11)out.push({m:'Commence par noter ton petit-déjeuner. Vise 20 à 30 g de protéines (œufs, skyr, fromage blanc) pour tenir jusqu’à midi.'});
  else if(!any&&h>=11)out.push({m:'Rien n’est noté pour l’instant. Une estimation approximative vaut mieux que rien, ajoute ton dernier repas.'});
  if(any&&c.eaten<1000&&h>=20)out.push({w:1,t:'Tu as peu mangé aujourd’hui',m:fmt(c.eaten)+' kcal seulement. Manger trop peu fatigue et fait perdre du muscle. Prévois un vrai dîner ou une collation avec des protéines.'});
  if(c.left<0)out.push({w:1,t:'Tu dépasses ton budget de '+fmt(-c.left)+' kcal',m:'Ce n’est pas grave, une journée ne change pas la tendance. Reprends normalement au prochain repas, sans te priver.'});
  if(any&&c.prot<c.protT*0.6&&h>=16)out.push({t:'Il te manque des protéines',m:'Tu en es à '+fmt(c.prot)+' g sur '+c.protT+' g. Idées : skyr, œufs, thon, poulet, tofu, fromage blanc.'});
  if(c.waterT&&d.water<c.waterT*0.5&&h>=15)out.push({t:'Pense à boire',m:fmt(d.water)+' ml sur '+fmt(c.waterT)+' ml. Un grand verre maintenant ?'});
  if(isToday&&h>=18&&d.steps<S.profile.refSteps*0.6)out.push({t:'Il manque des pas',m:'15 minutes de marche, c’est environ 1 500 pas. Une petite sortie après le dîner suffit souvent.'});
  var week=0;for(var i=0;i<7;i++){week+=D(addDays(k,-i)).work.length}
  if(isToday&&week===0&&out.length<2)out.push({t:'Pas de séance cette semaine',m:'Essaie la séance A, 30 minutes sans matériel. Tu la trouves dans l’onglet Sport.'});
  if(!out.length&&any)out.push({m:'Tu es sur une bonne trajectoire aujourd’hui. Continue à noter tes repas au fur et à mesure.'});
  if(!out.length)out.push({m:'Note ce que tu manges et bois, le reste se calcule tout seul.'});
  return out.slice(0,2);
}

/* ---------- Rendu : onglets ---------- */
var ICONS={
 jour:'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
 repas:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
 sport:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
 poids:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 9.5a5 5 0 0 1 7 0M12 10l1.5 2"/>',
 bilan:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
 guide:'<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M8 8h6"/>'
};
var TABS=[['jour','Jour'],['repas','Repas'],['sport','Sport'],['poids','Poids'],['bilan','Bilan'],['guide','Guide']];
function renderNav(){
  $('#nav').innerHTML=TABS.map(function(t){return '<button class="tab '+(ui.tab===t[0]?'on':'')+'" data-a="tab" data-t="'+t[0]+'" '+(ui.tab===t[0]?'aria-current="page"':'')+'><svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[t[0]]+'</svg>'+t[1]+'</button>'}).join('');
}
function renderTop(){
  var t=todayStr(),show=ui.tab!=='guide';
  var left=show?'<div class="datenav"><button class="ib" data-a="prev" aria-label="Jour précédent">‹</button><span class="lab">'+esc(dayLabel(ui.date))+'</span><button class="ib" data-a="next" aria-label="Jour suivant" '+(ui.date>=t?'disabled':'')+'>›</button></div>':'<span class="brand">Palestre</span>';
  return '<div class="top">'+left+'<span class="sync '+(syncState==='db'?'db':'')+'" id="sync" title="'+(syncState==='db'?'Tes données sont enregistrées dans ton compte':'Tes données restent sur cet appareil')+'"><i></i>'+(syncState==='db'?'Enregistré':'Sur cet appareil')+'</span></div>';
}

function renderJour(){
  var k=ui.date,c=calc(k),d=D(k);
  var over=c.left<0,pct=c.budget>0?Math.min(1,c.eaten/c.budget):0,C=2*Math.PI*70;
  var ring='<svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="70" fill="none" stroke="var(--surface2)" stroke-width="14"/>'+(pct>0.004?'<circle cx="90" cy="90" r="70" fill="none" stroke="'+(over?'var(--over)':'var(--accent)')+'" stroke-width="14" stroke-linecap="round" stroke-dasharray="'+(C*pct).toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 90 90)"/>':'')+'</svg>';
  var center='<span class="lbl">'+(over?'Au-dessus de':'Il te reste')+'</span><b class="big '+(over?'over':'')+'">'+fmt(Math.abs(c.left))+'</b><span class="lbl">kcal</span>';
  var tips=advice(k,c).map(function(a){return '<div class="tip '+(a.w?'warn':'')+'"><span class="dot"></span><div>'+(a.t?'<b>'+esc(a.t)+'</b>':'')+'<span>'+esc(a.m)+'</span></div></div>'}).join('');
  var glasses='';for(var i=0;i<8;i++){glasses+='<i class="'+(d.water>=(i+1)*250-124?'on':'')+'"></i>'}
  var stepsPct=Math.min(100,d.steps/S.profile.refSteps*100),waterPct=Math.min(100,d.water/c.waterT*100),protPct=Math.min(100,c.prot/c.protT*100);
  var deficitLine=c.eaten>0?(c.deficit>=0?'Déficit estimé : '+fmt(c.deficit)+' kcal':'Surplus estimé : '+fmt(-c.deficit)+' kcal'):'';
  return '<div class="stack">'+
  '<section class="card hero"><div class="ring">'+ring+'<div class="ring-c">'+center+'</div></div>'+
  '<div class="stats"><div><span class="lbl">Mangé</span><b>'+fmt(c.eaten)+'</b></div><div><span class="lbl">Brûlé</span><b>'+fmt(c.burn)+'</b></div><div><span class="lbl">Budget</span><b>'+fmt(c.budget)+'</b></div></div>'+
  '<p class="note">Brûlé = '+fmt(c.base)+' de base (métabolisme et vie assise) + '+fmt(c.stepK)+' de marche + '+fmt(c.workK)+' de sport.'+(c.bonus>0?' Ton activité en plus ajoute '+fmt(c.bonus)+' kcal à ton budget.':'')+(deficitLine?'<br>'+deficitLine+'.':'')+'</p></section>'+
  tips+sundayTip(k)+dinnerCard(k,c)+
  '<div class="grid2">'+
   '<section class="card"><span class="lbl">Eau</span><div class="val num">'+fmt(d.water)+' <small>/ '+fmt(c.waterT)+' ml</small></div><div class="bar"><i style="--w:'+waterPct+'%;--c:var(--water)"></i></div><div class="gl" aria-hidden="true">'+glasses+'</div><div class="btns">'+S.profile.bottles.map(function(b){return '<button class="btn sm" data-a="water" data-ml="'+b.ml+'">+ '+esc(b.n)+'</button>'}).join('')+'<button class="btn sm ghost" data-a="waterundo">Annuler le dernier</button></div><p class="small" style="margin-top:6px">Un tap = tu as bu la gourde en entier.</p></section>'+
   '<section class="card"><span class="lbl">Pas</span><div class="val num">'+fmt(d.steps)+' <small>/ '+fmt(S.profile.refSteps)+' habituels</small></div><div class="bar"><i style="--w:'+stepsPct+'%;--c:var(--steps)"></i></div><label class="f">Mon total de la journée<input class="inp" id="steps" type="number" inputmode="numeric" min="0" step="100" placeholder="ex. 8 000" value="'+(d.steps||'')+'"></label><p class="small" style="margin-top:8px">≈ '+fmt(c.stepK)+' kcal brûlées en marchant</p></section>'+
  '</div>'+
  '<section class="card"><span class="lbl">Protéines</span><div class="val num">'+fmt(c.prot)+' <small>/ '+c.protT+' g</small></div><div class="bar"><i style="--w:'+protPct+'%;--c:var(--protein)"></i></div><p class="small">Elles aident à garder et construire du muscle pendant la perte de poids.</p></section>'+feelCard(k,d)+
  '</div>';
}

function renderMeals(){
  var k=ui.date,c=calc(k),d=D(k);
  return '<div class="stack">'+MEALS.map(function(m){
    var items=d.meals[m[0]],sub=items.reduce(function(a,i){return a+i.k*i.q},0),ref=Math.round(c.target*m[2]/10)*10;
    var list=items.length?'<div class="items">'+items.map(function(i,ix){return '<div class="item"><div class="nm"><b>'+esc(i.n)+'</b><span class="small">'+esc(i.u)+(i.q!==1?' × '+fmt1(i.q):'')+'</span></div><span class="k">'+fmt(i.k*i.q)+' kcal</span><button class="x" data-a="delitem" data-m="'+m[0]+'" data-i="'+ix+'" aria-label="Supprimer '+esc(i.n)+'">×</button></div>'}).join('')+'</div>':'<p class="empty">Rien d’ajouté. Repère : environ '+ref+' kcal.</p>';
    return '<section class="card"><div class="meal-h"><h3>'+m[1]+'</h3><span class="small num">'+fmt(sub)+' kcal'+(items.length?' · repère '+ref:'')+'</span></div>'+list+'<div class="btns" style="margin-top:8px"><button class="btn" style="flex:1" data-a="addfood" data-m="'+m[0]+'">+ Ajouter</button>'+(items.length?'<button class="btn" data-a="favsave" data-m="'+m[0]+'">★ Favori</button>':'')+'</div></section>';
  }).join('')+
  '<p class="note">Total du jour : <b class="num">'+fmt(c.eaten)+'</b> kcal sur un budget de '+fmt(c.budget)+'.</p></div>';
}

function renderSport(){
  var k=ui.date,d=D(k),w=curKg();
  var work=d.work.length?'<div class="items">'+d.work.map(function(x,ix){return '<div class="item"><div class="nm"><b>'+esc(x.n)+'</b><span class="small">'+fmt(x.min)+' min</span></div><span class="k">'+fmt(x.kcal)+' kcal</span><button class="x" data-a="workdel" data-i="'+ix+'" aria-label="Supprimer">×</button></div>'}).join('')+'</div>':'<p class="empty">Aucune activité notée ce jour.</p>';
  var progs=PROGS.map(function(p){
    var open=ui.prog===p.id;
    return '<div class="prog"><button class="ph" data-a="prog" data-p="'+p.id+'" aria-expanded="'+open+'"><span><b>'+esc(p.t)+'</b><span class="small">'+p.min+' min · sans matériel</span></span><span aria-hidden="true">'+(open?'−':'+')+'</span></button>'+
    (open?'<div class="exs">'+p.ex.map(function(e){return '<div class="ex"><b>'+esc(e[0])+'</b><span class="r">'+esc(e[1])+'</span><p>'+esc(e[2])+'</p></div>'}).join('')+'<button class="btn pri wide" style="margin-top:12px" data-a="gstart" data-p="'+p.id+'">▶ Séance guidée</button><button class="btn wide" style="margin-top:8px" data-a="progdone" data-p="'+p.id+'">Séance faite · ajouter '+p.min+' min</button></div>':'')+'</div>';
  }).join('');
  return '<div class="stack">'+
  '<section class="card"><h3>Activité du jour</h3>'+work+
  '<div class="fgrid" style="margin-top:10px"><label class="f">Activité<select class="inp" id="wt">'+ACTS.map(function(a,i){return '<option value="'+i+'">'+esc(a[0])+'</option>'}).join('')+'</select></label><label class="f">Minutes<input class="inp" id="wm" type="number" inputmode="numeric" min="1" max="300" value="30"></label></div>'+
  '<div class="row" style="margin-top:10px"><span class="small" id="west"></span><button class="btn pri" data-a="workadd">Ajouter</button></div>'+
  '<p class="small" style="margin-top:8px">Ne note pas ici la marche déjà comptée dans tes pas.</p></section>'+
  '<section class="card"><h3>Ton programme pour tonifier</h3><p class="small" style="margin-bottom:10px">3 séances par semaine, jamais deux jours d’affilée au début. Repos de 45 à 60 secondes entre les séries.</p><div class="stack" style="gap:8px">'+progs+'</div></section>'+
  '<section class="card"><h3>Progresser sans te blesser</h3><ul class="ul small"><li>Quand toutes les répétitions deviennent faciles, ajoute 2 répétitions ou une série la semaine suivante.</li><li>Après 4 semaines, passe à des haltères ou des bouteilles plus lourdes.</li><li>Une courbature légère est normale. Une douleur vive dans une articulation ne l’est pas : arrête et demande l’avis d’un professionnel.</li></ul></section>'+
  '</div>';
}

function weightChart(){
  var ws=S.weights.slice().sort(function(a,b){return a.d<b.d?-1:1}),g=S.profile.goalKg;
  var W0=340,H0=190,pl=34,pr=14,pt=14,pb=26;
  var mn=Math.min(g,Math.min.apply(null,ws.map(function(x){return x.kg}))),mx=Math.max.apply(null,ws.map(function(x){return x.kg}));
  var y0=Math.floor((mn-1)/5)*5,y1=Math.ceil((mx+1)/5)*5;
  function Y(v){return pt+(y1-v)/(y1-y0)*(H0-pt-pb)}
  var t0=parse(ws[0].d).getTime(),t1=parse(ws[ws.length-1].d).getTime();
  function X(d){if(t1===t0)return (pl+W0-pr)/2;return pl+(parse(d).getTime()-t0)/(t1-t0)*(W0-pl-pr)}
  var grid='';for(var v=y0;v<=y1;v+=5){grid+='<line x1="'+pl+'" x2="'+(W0-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="var(--line)" stroke-width="1"/><text x="'+(pl-6)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+v+'</text>'}
  var pts=ws.map(function(x){return X(x.d).toFixed(1)+','+Y(x.kg).toFixed(1)}).join(' ');
  var last=ws[ws.length-1],first=ws[0];
  var dl=function(s){return parse(s).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})};
  return '<svg class="chart" viewBox="0 0 '+W0+' '+H0+'" role="img" aria-label="Courbe de poids, dernier poids '+fmt1(last.kg)+' kilos, objectif '+g+' kilos">'+grid+
   '<line x1="'+pl+'" x2="'+(W0-pr)+'" y1="'+Y(g)+'" y2="'+Y(g)+'" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="'+(W0-pr)+'" y="'+(Y(g)-5)+'" text-anchor="end" style="fill:var(--accent)">objectif '+g+' kg</text>'+
   (ws.length>1?'<polyline points="'+pts+'" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>':'')+
   ws.map(function(x){return '<circle cx="'+X(x.d).toFixed(1)+'" cy="'+Y(x.kg).toFixed(1)+'" r="3.5" fill="var(--ink)"/>'}).join('')+
   '<circle cx="'+X(last.d).toFixed(1)+'" cy="'+Y(last.kg).toFixed(1)+'" r="6" fill="var(--accent)"/>'+
   '<text x="'+X(last.d).toFixed(1)+'" y="'+(Y(last.kg)-11)+'" text-anchor="'+(ws.length>1?'end':'middle')+'" style="fill:var(--ink);font-weight:700">'+fmt1(last.kg)+' kg</text>'+
   '<text x="'+pl+'" y="'+(H0-6)+'" text-anchor="start">'+dl(first.d)+'</text>'+(ws.length>1?'<text x="'+(W0-pr)+'" y="'+(H0-6)+'" text-anchor="end">'+dl(last.d)+'</text>':'')+
  '</svg>';
}

function renderPoids(){
  var p=S.profile,cur=curKg(),lost=p.startKg-cur,rest=cur-p.goalKg;
  var pct=Math.max(0,Math.min(100,(p.startKg-cur)/(p.startKg-p.goalKg)*100));
  var weeks=rest>0?Math.round(rest/0.4):0;
  var ws=S.weights.slice().sort(function(a,b){return a.d<b.d?1:-1}).slice(0,8);
  var h=p.height/100,bmiG=p.goalKg/(h*h);
  var list=ws.map(function(x){return '<div class="item"><div class="nm"><b>'+fmt1(x.kg)+' kg</b></div><span class="small">'+esc(parse(x.d).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}))+'</span><button class="x" data-a="wtdel" data-d="'+x.d+'" aria-label="Supprimer cette pesée">×</button></div>'}).join('');
  var prof='<section class="card"><div class="row"><h3 style="margin:0">Mon profil</h3><button class="btn sm" data-a="profopen" aria-expanded="'+ui.profOpen+'">'+(ui.profOpen?'Fermer':'Modifier')+'</button></div>'+
   (ui.profOpen?'<div class="fgrid" style="margin-top:12px">'+
    pf('age','Âge',p.age)+pf('height','Taille (cm)',p.height)+pf('startKg','Poids de départ (kg)',p.startKg)+pf('goalKg','Poids visé (kg)',p.goalKg)+pf('refSteps','Pas habituels / jour',p.refSteps)+
    '<label class="f">Sexe<select class="inp" data-prof="sex"><option value="f" '+(p.sex==='f'?'selected':'')+'>Femme</option><option value="m" '+(p.sex==='m'?'selected':'')+'>Homme</option></select></label></div>':
    '<p class="small" style="margin-top:6px">'+p.age+' ans · '+p.height+' cm · départ '+fmt1(p.startKg)+' kg · objectif '+fmt1(p.goalKg)+' kg · '+fmt(p.refSteps)+' pas habituels</p>')+'</section>';
  return '<div class="stack">'+
  '<section class="card"><div class="kv"><div><span class="lbl">Actuel</span><b>'+fmt1(cur)+'</b></div><div><span class="lbl">Perdu</span><b>'+fmt1(Math.max(0,lost))+'</b></div><div><span class="lbl">À perdre</span><b>'+fmt1(Math.max(0,rest))+'</b></div></div>'+
  '<div class="bar" style="margin-top:12px"><i style="--w:'+pct+'%"></i></div><p class="small">'+(rest>0?'Objectif '+fmt1(p.goalKg)+' kg (IMC '+fmt1(bmiG)+', dans la zone de santé). Au rythme visé de 0,4 kg par semaine, compte environ '+weeks+' semaines, avec des hauts et des bas.':'Objectif atteint. Bravo, tu peux maintenant stabiliser.')+'</p></section>'+
  '<section class="card"><h3>Courbe</h3>'+weightChart()+'</section>'+
  '<section class="card"><h3>Noter une pesée</h3><div class="fgrid"><label class="f">Poids (kg)<input class="inp" id="wkg" type="number" inputmode="decimal" step="0.1" min="30" max="250" placeholder="ex. 74,6"></label><label class="f">Date<input class="inp" id="wdate" type="date" value="'+ui.date+'" max="'+todayStr()+'"></label></div><button class="btn pri wide" style="margin-top:10px" data-a="wtadd">Enregistrer</button><p class="small" style="margin-top:8px">Pèse-toi une fois par semaine, le matin, à jeun. Regarde la tendance sur 3 à 4 semaines.</p>'+(list?'<div class="items" style="margin-top:8px">'+list+'</div>':'')+'</section>'+
  prof+'</div>';
}
function pf(key,label,val){return '<label class="f">'+label+'<input class="inp" data-prof="'+key+'" type="number" inputmode="decimal" step="any" value="'+val+'"></label>'}

function renderGuide(){
  var c=calc(todayStr()),p=S.profile;
  return '<div class="stack">'+
  '<section class="card"><h3>Pourquoi '+fmt(c.target)+' kcal par jour</h3><p>Avec tes '+fmt(p.refSteps)+' pas habituels, ton corps brûle environ '+fmt(c.refBurn)+' kcal par jour. On retire 450 kcal pour perdre à peu près 0,4 kg par semaine, un rythme qui protège tes muscles. Quand tu marches plus ou que tu fais du sport, l’appli te rend la moitié des calories brûlées en plus, pour ne pas te faire manger trop peu.</p></section>'+
  '<section class="card sec"><h3>Estimer sans balance</h3><p class="small">Utilise ta main, elle est toujours avec toi.</p><div class="hand"><b>Paume</b><span>une portion de viande ou de poisson (100 à 120 g)</span><b>Poing</b><span>une portion de féculents cuits (riz, pâtes : environ 150 g)</span><b>Pouce</b><span>une portion de matière grasse (1 c. à soupe d’huile, une noix de beurre)</span><b>Main creuse</b><span>une portion de noix ou d’amandes (20 à 30 g)</span><b>Deux mains</b><span>des légumes, sans compter</span></div><p style="margin-top:6px">Une assiette équilibrée : la moitié de légumes, un quart de protéines, un quart de féculents, plus un peu de matière grasse.</p></section>'+
  '<section class="card sec"><h3>Répartition conseillée</h3><div class="hand">'+MEALS.map(function(m){return '<b>'+m[1]+'</b><span>environ '+Math.round(c.target*m[2]/10)*10+' kcal</span>'}).join('')+'</div></section>'+
  '<section class="card"><h3>Les règles qui marchent</h3><ul class="ul"><li>Vise 20 à 30 g de protéines à chaque repas (œufs, skyr, poulet, poisson, tofu, légumineuses). C’est ce qui aide à tonifier.</li><li>Note tes repas juste après les avoir mangés, pas le soir de mémoire.</li><li>Ton poids varie de 1 à 2 kg selon l’eau, le sel et ton cycle. C’est normal, regarde la tendance.</li><li>Ne descends pas sous 1 200 kcal. Trop peu, c’est de la fatigue, de la perte de muscle et des craquages.</li><li>Un écart ne ruine rien. Reprends au repas suivant.</li><li>Dors 7 heures ou plus : le manque de sommeil augmente la faim.</li></ul></section>'+
  '<section class="card"><h3>À savoir</h3><p class="small">Les calories brûlées et les calories des aliments sont des estimations, avec une marge d’environ 15 %. Si ton poids stagne 3 à 4 semaines malgré un suivi régulier, ajoute des pas ou retire 100 kcal, pas plus. Cette appli ne remplace pas un avis médical. En cas de maladie, de grossesse, ou si les chiffres te stressent, parles-en à ton médecin ou à une diététicienne.</p></section>'+dataCard()+
  '</div>';
}

function render(){
  ensure();var y=window.scrollY,tab=ui.tab,body;
  if(tab==='jour')body=renderJour();else if(tab==='repas')body=renderMeals();else if(tab==='sport')body=renderSport();else if(tab==='poids')body=renderPoids();else if(tab==='bilan')body=renderBilan();else body=renderGuide();
  $('#app').innerHTML=renderTop()+body;
  renderNav();
  if(ui.tab==='sport')updWork();
  if(render.last===tab)window.scrollTo(0,y);else window.scrollTo(0,0);
  render.last=tab;
}

/* ---------- Feuille d'ajout d'aliment ---------- */
function allFoods(){return S.profile.custom.map(function(f){return {c:'cus',n:f.n,u:f.u,k:f.k,p:f.p}}).concat(FOODS)}
function shownFoods(s){
  var q=norm(s.q.trim());
  if(q)return allFoods().filter(function(f){return norm(f.n+' '+f.u).indexOf(q)>-1});
  if(s.cat==='fav')return favList();
  if(s.cat==='rec')return S.profile.recent;
  if(s.cat==='cus')return S.profile.custom;
  return FOODS.filter(function(f){return f.c===s.cat});
}
function renderFoodList(){
  var s=ui.sheet,el=$('#flist');if(!s||!el)return;
  var items=shownFoods(s);s.shown=items;
  if(!items.length){el.innerHTML='<p class="empty">'+(s.q?'Aucun résultat. Tu peux saisir les calories à la main ci-dessous.':(s.cat==='fav'?'Enregistre un repas avec « ★ Favori » dans l’onglet Repas : il apparaîtra ici.':s.cat==='rec'?'Tes aliments récents apparaîtront ici.':'Aucun aliment pour l’instant.'))+'</p>';return}
  el.innerHTML=items.map(function(f,i){if(f.fav)return '<div class="row"><button class="frow" data-a="pick" data-i="'+i+'"><span class="fn">'+esc(f.n)+'<small>'+esc(f.u)+'</small></span><span class="fk">'+fmt(f.k)+'<small>kcal</small></span></button><button class="x" data-a="favdel" data-i="'+i+'" aria-label="Supprimer ce favori">×</button></div>';return '<button class="frow" data-a="pick" data-i="'+i+'"><span class="fn">'+esc(f.n)+'<small>'+esc(f.u)+'</small></span><span class="fk">'+fmt(f.k)+'<small>kcal</small></span></button>'}).join('');
}
function renderSheet(){
  var el=$('#sheet'),s=ui.sheet;
  if(ui.guide){renderGuideSheet(el);return}
  if(!s){el.hidden=true;el.innerHTML='';document.body.style.overflow='';return}
  el.hidden=false;document.body.style.overflow='hidden';
  var mealName=MEALS.filter(function(m){return m[0]===s.meal})[0][1],body='';
  if(s.mode==='list'){
    body='<input id="q" class="inp" type="search" placeholder="Chercher (riz, yaourt, pomme…)" value="'+esc(s.q)+'" autocomplete="off" aria-label="Chercher un aliment">'+
    '<div class="chips">'+CATS.map(function(c){return '<button class="chip '+(s.cat===c[0]&&!s.q?'on':'')+'" data-a="cat" data-c="'+c[0]+'">'+c[1]+'</button>'}).join('')+'</div><div id="flist"></div>'+
    '<button class="btn wide" style="margin-top:8px" data-a="manual">Saisir les calories à la main</button>';
  }else if(s.mode==='detail'){
    var it=s.sel;
    body='<button class="btn ghost" style="align-self:flex-start" data-a="back">‹ Retour à la liste</button><div class="det"><h3>'+esc(it.n)+'</h3><p class="muted">'+esc(it.u)+'</p>'+
    '<div class="stepper"><button class="btn sq" data-a="qty" data-d="-0.5" aria-label="Moins">−</button><output>'+fmt1(s.qty)+'</output><button class="btn sq" data-a="qty" data-d="0.5" aria-label="Plus">+</button></div>'+
    '<p class="det-k"><b>'+fmt(it.k*s.qty)+'</b> kcal · '+fmt1((it.p||0)*s.qty)+' g de protéines</p><button class="btn pri wide" data-a="confirm">Ajouter au '+esc(mealName.toLowerCase())+'</button></div>';
  }else{
    body='<button class="btn ghost" style="align-self:flex-start" data-a="back">‹ Retour à la liste</button><div class="stack" style="margin-top:6px">'+
    '<label class="f">Nom<input class="inp" id="mn" type="text" placeholder="ex. Plat du restaurant"></label>'+
    '<div class="fgrid"><label class="f">Calories (kcal)<input class="inp" id="mk" type="number" inputmode="numeric" min="1" placeholder="ex. 450"></label><label class="f">Protéines (g), facultatif<input class="inp" id="mp" type="number" inputmode="numeric" min="0" placeholder="ex. 20"></label></div>'+
    '<label class="f" style="flex-direction:row;align-items:center;gap:10px"><input id="mc" type="checkbox" style="width:22px;height:22px"> Garder dans « Mes aliments »</label>'+
    '<button class="btn pri wide" data-a="savemanual">Ajouter au '+esc(mealName.toLowerCase())+'</button></div>';
  }
  el.innerHTML='<div class="sh-back" data-a="close"></div><div class="sh-panel" role="dialog" aria-modal="true" aria-label="Ajouter au '+esc(mealName)+'"><div class="sh-head"><h2>'+esc(mealName)+'</h2><button class="btn ghost" data-a="close">Fermer</button></div>'+body+'</div>';
  if(s.mode==='list')renderFoodList();
}
function toast(m){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true},1800)}
function addRecent(f){
  var r=S.profile.recent.filter(function(x){return !(x.n===f.n&&x.u===f.u)});
  r.unshift({n:f.n,u:f.u,k:f.k,p:f.p||0});S.profile.recent=r.slice(0,15);
}
function updWork(){
  var t=$('#wt'),m=$('#wm'),e=$('#west');if(!t||!m||!e)return;
  var mins=num(m.value);
  if(!(mins>0)){e.textContent='';return}
  e.textContent='≈ '+fmt(workKcal(+t.value,mins))+' kcal brûlées';
}
function workKcal(i,min){return Math.max(0,(ACTS[i][1]-1)*curKg()*min/60)}

/* ---------- Actions ---------- */
var A={
 tab:function(b){ui.tab=b.dataset.t;render()},
 prev:function(){ui.date=addDays(ui.date,-1);render()},
 next:function(){if(ui.date<todayStr()){ui.date=addDays(ui.date,1);render()}},
 water:function(b){var d=W(ui.date),ml=+b.dataset.ml;d.water+=ml;d.waterLog=(d.waterLog||[]).concat([ml]);touch(ui.date);render()},
 waterundo:function(){var d=W(ui.date),log=d.waterLog||[],ml=log.length?log[log.length-1]:Math.min(250,d.water);d.waterLog=log.slice(0,-1);d.water=Math.max(0,d.water-ml);touch(ui.date);render()},
 addfood:function(b){ui.sheet={meal:b.dataset.m,mode:'list',cat:S.profile.recent.length?'rec':'pd',q:'',sel:null,qty:1,shown:[]};renderSheet()},
 close:function(){ui.sheet=null;renderSheet()},
 cat:function(b){var s=ui.sheet;s.cat=b.dataset.c;s.q='';renderSheet()},
 pick:function(b){var s=ui.sheet,f=s.shown[+b.dataset.i];if(!f)return;s.sel={n:f.n,u:f.u,k:f.k,p:f.p||0};s.qty=1;s.mode='detail';renderSheet()},
 back:function(){ui.sheet.mode='list';renderSheet()},
 qty:function(b){var s=ui.sheet;s.qty=Math.max(0.5,Math.min(10,s.qty+(+b.dataset.d)));renderSheet()},
 confirm:function(){var s=ui.sheet,f=s.sel;W(ui.date).meals[s.meal].push({n:f.n,u:f.u,k:f.k,p:f.p,q:s.qty});addRecent(f);touch(ui.date);touch('profile');ui.sheet=null;renderSheet();render();toast('Ajouté')},
 manual:function(){ui.sheet.mode='manual';renderSheet()},
 savemanual:function(){
   var s=ui.sheet,k=num($('#mk').value),p=num($('#mp').value),n=$('#mn').value.trim()||'Saisie manuelle';
   if(!(k>0)){toast('Indique un nombre de calories');return}
   var f={n:n,u:'1 portion',k:Math.round(k),p:p>0?Math.round(p):0};
   W(ui.date).meals[s.meal].push({n:f.n,u:f.u,k:f.k,p:f.p,q:1});
   if($('#mc').checked)S.profile.custom.unshift(f);
   touch(ui.date);touch('profile');ui.sheet=null;renderSheet();render();toast('Ajouté');
 },
 delitem:function(b){W(ui.date).meals[b.dataset.m].splice(+b.dataset.i,1);touch(ui.date);render()},
 workadd:function(){
   var i=+$('#wt').value,m=num($('#wm').value);
   if(!(m>0)){toast('Indique une durée en minutes');return}
   W(ui.date).work.push({n:ACTS[i][0],min:Math.round(m),kcal:Math.round(workKcal(i,m))});touch(ui.date);render();toast('Activité ajoutée');
 },
 workdel:function(b){W(ui.date).work.splice(+b.dataset.i,1);touch(ui.date);render()},
 prog:function(b){ui.prog=ui.prog===b.dataset.p?'':b.dataset.p;render()},
 progdone:function(b){
   var p=PROGS.filter(function(x){return x.id===b.dataset.p})[0];
   W(ui.date).work.push({n:p.t.split(' · ')[0]+' ('+p.t.split(' · ')[1].toLowerCase()+')',min:p.min,kcal:Math.round(workKcal(0,p.min))});
   touch(ui.date);render();toast('Séance enregistrée, bravo');
 },
 wtadd:function(){
   var kg=num($('#wkg').value),d=$('#wdate').value||ui.date;
   if(!(kg>=30&&kg<=250)){toast('Indique un poids entre 30 et 250 kg');return}
   S.weights=S.weights.filter(function(x){return x.d!==d});S.weights.push({d:d,kg:Math.round(kg*10)/10});
   touch('profile');render();toast('Pesée enregistrée');
 },
 wtdel:function(b){S.weights=S.weights.filter(function(x){return x.d!==b.dataset.d});if(!S.weights.length)S.weights=[{d:todayStr(),kg:S.profile.startKg}];touch('profile');render()},
 profopen:function(){ui.profOpen=!ui.profOpen;render()}
};
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-a]');if(!b)return;
  var f=A[b.dataset.a];if(f)f(b,e);
});
document.addEventListener('input',function(e){
  var t=e.target;
  if(t.id==='q'&&ui.sheet){ui.sheet.q=t.value;var chips=document.querySelectorAll('.chip');Array.prototype.forEach.call(chips,function(c){c.classList.toggle('on',!t.value&&c.dataset.c===ui.sheet.cat)});renderFoodList()}
  else if(t.id==='wm'||t.id==='wt')updWork();
});
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='steps'){var v=num(t.value);W(ui.date).steps=v>0?Math.round(v):0;touch(ui.date);render()}
  else if(t.id==='wt')updWork();
  else if(t.dataset&&t.dataset.prof){
    var key=t.dataset.prof,p=S.profile;
    if(key==='sex'){p.sex=t.value==='m'?'m':'f'}
    else{
      var v2=num(t.value),lim={age:[14,90],height:[120,220],startKg:[30,250],goalKg:[30,250],refSteps:[0,40000]}[key];
      if(isFinite(v2)&&lim&&v2>=lim[0]&&v2<=lim[1])p[key]=v2;else toast('Valeur hors limites');
    }
    touch('profile');render();
  }
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ui.sheet){ui.sheet=null;renderSheet()}});

/* ---------- Ajouts : favoris, ressenti, ce soir, séance guidée, bilans, données ---------- */
function ensure(){var p=S.profile;p.favs=p.favs||[];p.bilans=p.bilans||{}}
function favList(){return S.profile.favs.map(function(x){var k=0,p=0;x.items.forEach(function(i){k+=i.k*i.q;p+=(i.p||0)*i.q});return {n:x.n,u:x.items.length+' aliment'+(x.items.length>1?'s':''),k:Math.round(k),p:Math.round(p),fav:1,items:x.items}})}
var _pick=A.pick;A.pick=function(b){var s=ui.sheet,f=s&&s.shown[+b.dataset.i];if(f&&f.fav){var m=s.meal;f.items.forEach(function(i){W(ui.date).meals[m].push({n:i.n,u:i.u,k:i.k,p:i.p,q:i.q})});touch(ui.date);ui.sheet=null;renderSheet();render();toast('Repas ajouté');return}_pick(b)};
var _add=A.addfood;A.addfood=function(b){_add(b);if(S.profile.favs.length){ui.sheet.cat='fav';renderSheet()}};
A.favsave=function(b){var it=D(ui.date).meals[b.dataset.m];if(!it.length)return;var n=it.slice(0,2).map(function(i){return i.n.split(' (')[0]}).join(' + ')+(it.length>2?' …':'');S.profile.favs=S.profile.favs.filter(function(x){return x.n!==n});S.profile.favs.unshift({n:n,items:JSON.parse(JSON.stringify(it))});S.profile.favs=S.profile.favs.slice(0,30);touch('profile');toast('Ajouté aux favoris')};
A.favdel=function(b){S.profile.favs.splice(+b.dataset.i,1);touch('profile');renderFoodList()};

function feelCard(k,d){
  function sc(f,lab,lo,hi){var h='';for(var v=1;v<=5;v++)h+='<button class="chip '+(d[f]===v?'on':'')+'" data-a="feel" data-f="'+f+'" data-v="'+v+'" aria-label="'+lab+' '+v+' sur 5">'+v+'</button>';return '<div><span class="lbl">'+lab+'</span><div class="chips" style="padding-block:6px">'+h+'</div><span class="small">1 = '+lo+' · 5 = '+hi+'</span></div>'}
  return '<section class="card"><h3>Comment je me sens</h3><div class="stack" style="gap:8px"><label class="f">Sommeil de la nuit (heures)<input class="inp" id="sleep" type="number" inputmode="decimal" step="0.25" min="0" max="24" placeholder="ex. 7,5" value="'+(d.sleep||'')+'"></label>'+sc('energy','Énergie','vidée','en forme')+sc('hunger','Faim','pas faim','très faim')+(d.hr?'<p class="small">FC au repos : '+fmt(d.hr)+' bpm (montre)</p>':'')+'</div></section>';
}
A.feel=function(b){var d=W(ui.date),f=b.dataset.f,v=+b.dataset.v;d[f]=d[f]===v?0:v;touch(ui.date);render()};

function dinnerIdeas(left,pl){
  var want=Math.max(300,Math.min(left,750)),day=new Date().getDate();
  return IDEAS.map(function(id,n){var its=id[1].map(function(r){var f=FOODS.filter(function(x){return x.n.indexOf(r[0])===0})[0];return f?{n:f.n,u:f.u,k:f.k,p:f.p||0,q:r[1]}:null}).filter(Boolean),k=0,p=0;its.forEach(function(i){k+=i.k*i.q;p+=i.p*i.q});return {n:id[0],items:its,k:k,p:p,s:Math.abs(k-want)-3*Math.min(p,pl,40)+((n*7+day)%6)*8}}).sort(function(a,b){return a.s-b.s}).slice(0,3);
}
function dinnerCard(k,c){
  if(k!==todayStr())return '';
  var pl=Math.max(0,c.protT-c.prot),ids=dinnerIdeas(c.left,pl);ui.ideas=ids;
  var head=c.left>=250?'Il te reste '+fmt(c.left)+' kcal et '+fmt(pl)+' g de protéines.':'Tu es proche de ton budget : un dîner léger mais complet suffit.';
  return '<section class="card"><h3>Que manger ce soir ?</h3><p class="small" style="margin-bottom:6px">'+head+'</p><div class="items">'+ids.map(function(x,i){return '<div class="item"><div class="nm"><b>'+esc(x.n)+'</b><span class="small">'+fmt(x.k)+' kcal · '+fmt(x.p)+' g de protéines</span></div><button class="btn sm" data-a="dinneradd" data-i="'+i+'">Ajouter</button></div>'}).join('')+'</div></section>';
}
A.dinneradd=function(b){var x=ui.ideas&&ui.ideas[+b.dataset.i];if(!x)return;x.items.forEach(function(i){W(ui.date).meals.di.push({n:i.n,u:i.u,k:i.k,p:i.p,q:i.q})});touch(ui.date);render();toast('Ajouté au dîner')};
function sundayTip(k){
  if(k!==todayStr()||parse(k).getDay()!==0||S.profile.bilans[k])return '';
  return '<div class="tip"><span class="dot"></span><div><b>C’est dimanche, l’heure du bilan</b><span>Deux minutes pour regarder la semaine et préparer la suivante.</span><div style="margin-top:8px"><button class="btn sm pri" data-a="tab" data-t="bilan">Faire mon bilan</button></div></div></div>';
}

function gtick(){
  clearInterval(gtick.i);if(!ui.gt)return;
  function upd(){var r=Math.ceil((ui.gt-Date.now())/1000),el=$('#rt');if(r<=0){ui.gt=0;clearInterval(gtick.i);if(el)el.textContent='Terminé !';try{navigator.vibrate&&navigator.vibrate(300)}catch(e){}return}if(el)el.textContent=Math.floor(r/60)+':'+String(r%60).padStart(2,'0')}
  upd();gtick.i=setInterval(upd,250);
}
function renderGuideSheet(el){
  var g=ui.guide,p=PROGS.filter(function(x){return x.id===g.p})[0],e=p.ex[g.i],n=p.ex.length,last=g.i===n-1;
  var m=/(\d+)\s*s\b/.exec(e[1]),mn=/(\d+)\s*min/.exec(e[1]),sec=m?+m[1]:(mn?+mn[1]*60:0);
  el.hidden=false;document.body.style.overflow='hidden';
  el.innerHTML='<div class="sh-back"></div><div class="sh-panel" role="dialog" aria-modal="true" aria-label="Séance guidée"><div class="sh-head"><h2>'+esc(p.t.split(' · ')[0])+'</h2><button class="btn ghost" data-a="gclose">Quitter</button></div><div class="bar"><i style="--w:'+((g.i+1)/n*100)+'%"></i></div><p class="small">Étape '+(g.i+1)+' sur '+n+'</p><div class="det"><h3>'+esc(e[0])+'</h3><b class="big" style="font-size:30px">'+esc(e[1])+'</b><p>'+esc(e[2])+'</p><output class="big" id="rt" style="font-size:40px"></output><div class="btns" style="justify-content:center">'+(sec?'<button class="btn" data-a="gtime" data-s="'+sec+'">Chrono '+(sec>=60?(sec/60)+' min':sec+' s')+'</button>':'')+'<button class="btn" data-a="gtime" data-s="45">Repos 45 s</button></div></div><div class="row"><button class="btn" data-a="gprev" '+(g.i?'':'disabled')+'>‹ Précédent</button>'+(last?'<button class="btn pri" data-a="gdone">Terminer</button>':'<button class="btn pri" data-a="gnext">Suivant ›</button>')+'</div></div>';
  gtick();
}
A.gstart=function(b){ui.guide={p:b.dataset.p,i:0};ui.gt=0;renderSheet()};
A.gclose=function(){ui.guide=null;ui.gt=0;clearInterval(gtick.i);renderSheet()};
A.gnext=function(){ui.guide.i++;ui.gt=0;renderSheet()};
A.gprev=function(){ui.guide.i=Math.max(0,ui.guide.i-1);ui.gt=0;renderSheet()};
A.gtime=function(b){ui.gt=Date.now()+(+b.dataset.s)*1000;gtick()};
A.gdone=function(){var p=ui.guide.p;A.gclose();A.progdone({dataset:{p:p}})};

function sundayOf(k){return addDays(k,-parse(k).getDay())}
function wAt(d){var w=S.weights.filter(function(x){return x.d<=d}).sort(function(a,b){return a.d<b.d?1:-1});return w.length?w[0].kg:null}
function weekStats(end){
  var o={logged:0,kc:0,bud:0,prot:0,protT:0,water:0,wn:0,steps:0,sn:0,sess:0,sleep:0,sl:0,en:0,enN:0,hu:0,huN:0,hr:0,hn:0};
  for(var i=6;i>=0;i--){var k=addDays(end,-i),d=D(k),c=calc(k);o.sess+=d.work.length;
    if(c.eaten>0){o.logged++;o.kc+=c.eaten;o.bud+=c.budget;o.prot+=c.prot;o.protT+=c.protT}
    if(d.water>0){o.water+=d.water;o.wn++}if(d.steps>0){o.steps+=d.steps;o.sn++}if(d.sleep>0){o.sleep+=d.sleep;o.sl++}
    if(d.energy>0){o.en+=d.energy;o.enN++}if(d.hunger>0){o.hu+=d.hunger;o.huN++}if(d.hr>0){o.hr+=d.hr;o.hn++}}
  return o;
}
function av(s,n,f,u){return n?(f||fmt)(s/n)+(u||''):'–'}
function kvr(a){return '<div class="kv" style="margin-top:12px">'+a.map(function(x){return '<div><span class="lbl">'+x[0]+'</span><b>'+x[1]+'</b></div>'}).join('')+'</div>'}
function renderBilan(){
  var end=ui.date,o=weekStats(end),L=o.logged,ak=L?o.kc/L:0,ab=L?o.bud/L:0,ap=L?o.prot/L:0;
  var we=wAt(end),wp=wAt(addDays(end,-7)),dw=(we!=null&&wp!=null)?we-wp:null;
  var dl=function(s){return parse(s).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})};
  var ins=[];
  if(L<4)ins.push('Seulement '+L+' jour'+(L>1?'s':'')+' noté'+(L>1?'s':'')+' sur 7 : note plus de repas pour un bilan fiable.');
  else ins.push(ak<=ab?'Tu restes dans ton budget en moyenne ('+fmt(ak)+' pour '+fmt(ab)+' kcal).':'Tu dépasses ton budget de '+fmt(ak-ab)+' kcal par jour en moyenne : regarde surtout les collations et les sauces, sans te priver.');
  if(L>=3&&ap<o.protT/L*0.8)ins.push('Tes protéines sont en retrait ('+fmt(ap)+' g par jour). Ajoutes-en à chaque repas : œufs, skyr, poisson, tofu.');
  if(o.sl>=3&&o.sleep/o.sl<7)ins.push('Ton sommeil moyen est de '+fmt1(o.sleep/o.sl)+' h. Sous 7 h, la faim augmente : c’est souvent le premier levier.');
  if(o.huN>=3&&o.hu/o.huN>=4)ins.push('Ta faim est souvent élevée. Mise sur protéines, légumes et féculents complets, et regarde ton sommeil.');
  if(o.enN>=3&&o.en/o.enN<=2.5)ins.push('Ton énergie est basse. Vérifie sommeil, eau et que tu ne manges pas trop peu. Si ça dure, parles-en à un professionnel de santé.');
  ins.push(o.sess>=3?'Belle semaine d’activité : '+o.sess+' séances ou activités.':'Objectif : 3 séances par semaine ('+o.sess+' cette semaine).');
  var sun=sundayOf(end),bl=S.profile.bilans[sun]||{},pv=S.profile.bilans[addDays(sun,-7)];
  return '<div class="stack"><section class="card"><h3>Bilan de la semaine</h3><p class="small">Les 7 jours jusqu’au '+esc(dl(end))+'. Change de jour avec les flèches en haut.</p>'+
   kvr([['Jours notés',L+'/7'],['Kcal / jour',av(o.kc,L)],['Budget / jour',av(o.bud,L)]])+
   kvr([['Protéines',av(o.prot,L,0,' g')],['Eau',av(o.water,o.wn,0,' ml')],['Pas',av(o.steps,o.sn)]])+
   kvr([['Séances',o.sess],['Sommeil',av(o.sleep,o.sl,fmt1,' h')],['Énergie',av(o.en,o.enN,fmt1,'/5')]])+
   kvr([['Faim',av(o.hu,o.huN,fmt1,'/5')],['Poids',dw==null?'–':(dw>0?'+':'')+fmt1(dw)+' kg'],['FC repos',av(o.hr,o.hn,0,' bpm')]])+'</section>'+
   ins.slice(0,4).map(function(t){return '<div class="tip"><span class="dot"></span><div>'+esc(t)+'</div></div>'}).join('')+
   '<section class="card sec"><h3>Bilan du dimanche</h3><p class="small">Semaine qui se termine le '+esc(dl(sun))+'. Deux minutes pour regarder en arrière et préparer la suite.</p>'+
   (pv&&pv.fix?'<div class="tip"><span class="dot"></span><div><b>Ton intention de la semaine dernière</b><span>'+esc(pv.fix)+'</span></div></div>':'')+
   '<label class="f">Ce qui a bien marché<input class="inp" data-bil="ok" data-d="'+sun+'" type="text" value="'+esc(bl.ok||'')+'" placeholder="ex. 3 séances faites"></label>'+
   '<label class="f">Un seul point à améliorer<input class="inp" data-bil="fix" data-d="'+sun+'" type="text" value="'+esc(bl.fix||'')+'" placeholder="ex. mieux dormir en semaine"></label>'+
   '<label class="f">Séances prévues la semaine prochaine<input class="inp" data-bil="sess" data-d="'+sun+'" type="number" inputmode="numeric" min="0" max="14" value="'+esc(bl.sess||'')+'"></label>'+
   '<p class="small">Pense aussi à ta pesée de la semaine (onglet Poids).</p></section></div>';
}

function dataCard(){
  var n=Object.keys(S.days).length;
  return '<section class="card sec"><h3>Mes données</h3><p class="small">'+n+' jour'+(n>1?'s':'')+' enregistré'+(n>1?'s':'')+'. Fais une sauvegarde de temps en temps, surtout avant de changer d’appareil ou de version.</p><div class="btns"><button class="btn" data-a="expjson">Exporter (JSON)</button><button class="btn" data-a="expcsv">Exporter (CSV)</button></div><label class="f">Restaurer une sauvegarde JSON<input class="inp" id="impjson" type="file" accept=".json,application/json"></label><label class="f">Importer les données de ma montre (CSV)<input class="inp" id="impwatch" type="file" accept=".csv,text/csv"></label><p class="small">Colonnes reconnues pour la montre : date, pas, sommeil (heures ou minutes), fc_repos. Séparateur virgule ou point-virgule.</p></section>';
}
function dlFile(name,text,mime){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);toast('Fichier exporté')}
A.expjson=function(){dlFile('palestre-'+todayStr()+'.json',JSON.stringify({app:'palestre',v:1,exported:new Date().toISOString(),profile:S.profile,weights:S.weights,days:S.days},null,1),'application/json')};
A.expcsv=function(){
  var rows=['date;kcal;proteines_g;eau_ml;pas;sport_min;sport_kcal;sommeil_h;energie;faim;fc_repos'];
  Object.keys(S.days).sort().forEach(function(k){var d=D(k),c=calc(k);rows.push([k,Math.round(c.eaten),Math.round(c.prot),d.water,d.steps,d.work.reduce(function(a,x){return a+x.min},0),Math.round(c.workK),d.sleep||'',d.energy||'',d.hunger||'',d.hr||''].join(';'))});
  dlFile('palestre-'+todayStr()+'.csv','\ufeff'+rows.join('\n'),'text/csv');
};
function impJson(txt){
  var o=JSON.parse(txt);if(!o||!o.days||!o.profile)throw 1;
  Object.keys(o.days).forEach(function(k){S.days[k]=normDay(o.days[k]);touch(k)});
  (o.weights||[]).forEach(function(w){S.weights=S.weights.filter(function(x){return x.d!==w.d});S.weights.push({d:w.d,kg:w.kg})});
  ['custom','favs'].forEach(function(key){(o.profile[key]||[]).forEach(function(x){if(!S.profile[key].some(function(y){return JSON.stringify(y)===JSON.stringify(x)}))S.profile[key].push(x)})});
  Object.keys(o.profile.bilans||{}).forEach(function(k){if(!S.profile.bilans[k])S.profile.bilans[k]=o.profile.bilans[k]});
  touch('profile');render();toast('Sauvegarde restaurée');
}
function impWatch(txt){
  var lines=txt.replace(/^\ufeff/,'').split(/\r?\n/).filter(function(l){return l.trim()}),sep=lines[0].indexOf(';')>-1?';':',';
  var hd=lines[0].split(sep).map(function(h){return norm(h.trim())});
  function ci(re){for(var i=0;i<hd.length;i++)if(re.test(hd[i]))return i;return -1}
  var cd=ci(/date|jour|day/),cs=ci(/steps|pas/),cz=ci(/sleep|sommeil/),ch=ci(/hr|fc|repos|frequence|heart/),n=0;
  if(cd<0)throw 1;
  lines.slice(1).forEach(function(l){
    var c=l.split(sep),v=(c[cd]||'').trim(),m=/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/.exec(v),k;
    if(m)k=m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
    else{m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(v);if(!m)return;k=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0')}
    var d=W(k),st=cs>-1?num(c[cs]):NaN,z=cz>-1?num(c[cz]):NaN,h=ch>-1?num(c[ch]):NaN,ok=false;
    if(st>0){d.steps=Math.round(st);ok=true}if(z>0){d.sleep=Math.round((z>24?z/60:z)*100)/100;ok=true}if(h>0){d.hr=Math.round(h);ok=true}
    if(ok){touch(k);n++}
  });
  render();toast(n?n+' jour'+(n>1?'s':'')+' importé'+(n>1?'s':''):'Aucune donnée reconnue');
}
document.addEventListener('change',function(e){
  var t=e.target;
  if(t.id==='sleep'){var v=num(t.value);W(ui.date).sleep=(v>0&&v<=24)?Math.round(v*100)/100:0;touch(ui.date);render()}
  else if(t.type==='file'&&t.files&&t.files[0]){var id=t.id,r=new FileReader();r.onload=function(){try{if(id==='impjson')impJson(r.result);else impWatch(r.result)}catch(x){toast('Fichier illisible')}};r.readAsText(t.files[0])}
  else if(t.dataset&&t.dataset.bil){var b=S.profile.bilans;b[t.dataset.d]=b[t.dataset.d]||{};b[t.dataset.d][t.dataset.bil]=t.value.trim();touch('profile');toast('Bilan enregistré')}
});

/* ---------- Démarrage ---------- */
render();
initDb();
})();