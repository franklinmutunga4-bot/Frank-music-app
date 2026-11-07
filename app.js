(function(){
'use strict';

/* ===== HELPERS ===== */
var $=function(id){return document.getElementById(id);};
function on(id,ev,fn){var e=$(id);if(e)e.addEventListener(ev,fn);}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function up(el,attr){while(el&&el.getAttribute){if(el.getAttribute(attr)!==null)return el;el=el.parentNode;}return null;}
function inside(el,id){while(el){if(el.id===id)return true;el=el.parentNode;}return false;}
function fail(e){if(window.onerror)window.onerror(String(e&&e.message||e),'',0);}

/* ===== STATE ===== */
var DEF=[[255,45,135],[122,44,255],[42,168,255],[193,60,255],[255,90,158]];
var MOODS={
  Chill:[[40,120,255],[90,60,255],[0,200,220],[60,90,230],[120,80,255]],
  Sunset:[[255,90,60],[255,45,111],[255,160,60],[190,40,120],[255,110,90]],
  Forest:[[20,180,120],[10,120,110],[90,210,90],[20,150,160],[50,200,140]],
  Night:[[60,30,160],[20,20,90],[130,40,200],[30,60,170],[90,30,140]],
  Gold:[[255,190,60],[255,120,40],[255,215,110],[220,90,40],[255,160,70]]
};
var mood=null;
function demo(){
  var L=[[0,'Neon tides are pulling me home'],[6,'Glass hearts glowing in the foam'],[12,'Hold the night a little while'],[18,'Let the colours melt and smile'],[26,''],[31,'Violet skies are breathing slow'],[37,'Every light begins to flow'],[43,'Stay with me until it ends'],[49,'Dream in colour, dream again']].map(function(x){return {t:x[0],s:x[1]};});
  return [
    {t:'Neon Tides',a:'Lumen Park',d:214,key:'demo-0',lrc:L,lyrics:L.map(function(x){return x.s;}).join('\n')},
    {t:'Melting Hours',a:'Velvet Static',d:187,key:'demo-1'},
    {t:'Glass Hearts',a:'Aurora Vale',d:243,key:'demo-2'},
    {t:'Violet Afterglow',a:'Noor & The Sky',d:201,key:'demo-3'}
  ];
}
var tracks=demo();
var idx=0,pos=0,playing=false,dragging=false,shuffle=false,repeat=0,hist=[],view='now',prevView='now',lyrOn=false,vp=1,plc=null;
var libTab='songs',libSub=null,libList=null,playlists=[],lyAl='l',chromeOff=false,chromeT=0,vdrag=false,bdrag=false;
var MAIN={now:1,browse:1,radio:1,lib:1,search:1};
try{playlists=JSON.parse(localStorage.getItem('np_pl')||'[]')||[];}catch(e){playlists=[];}
try{var sa=localStorage.getItem('np_lyal');if(sa==='l'||sa==='c'||sa==='r')lyAl=sa;}catch(e){}
var app=$('app'),seek=$('seek'),fill=$('fill'),art=$('art'),sheet=$('sheet');
var audio=new Audio();audio.preload='metadata';
var blobs=[],targetSpeed=1;

function fmt(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+('0'+s%60).slice(-2);}
function dur(){var k=tracks[idx];return k.src?(audio.duration||0):k.d;}
function ids(){var a=[],i;for(i=0;i<tracks.length;i++)a.push(i);return a;}
function order(){return plc||ids();}
var toastT;
function toast(m){var t=$('toast');t.textContent=m;t.className='toast glass on';clearTimeout(toastT);toastT=setTimeout(function(){t.className='toast glass';},2800);}

/* app class: on-now / playing / lyrmode (immersive lyrics) / chromeoff (controls hidden) */
function appCls(){
  var n=view==='now',L=lyrOn&&n;
  return 'app'+(n?' on-now':'')+(playing?' playing':'')+(L?' lyrmode':'')+(L&&chromeOff?' chromeoff':'');
}
function chromeHide(){
  if(dragging||vdrag){chromeT=setTimeout(chromeHide,1500);return;}
  chromeOff=true;app.className=appCls();
}
function chromeWake(){
  clearTimeout(chromeT);chromeOff=false;app.className=appCls();
  if(lyrOn&&view==='now')chromeT=setTimeout(chromeHide,3000);
}
function chromeReset(){clearTimeout(chromeT);chromeOff=false;app.className=appCls();}

/* ===== COLOURS ===== */
function setPal(p){for(var i=0;i<blobs.length;i++)blobs[i].tgt=p[i%p.length].slice();}
function rgb(c,m){return 'rgb('+(c[0]*m|0)+','+(c[1]*m|0)+','+(c[2]*m|0)+')';}
function hsl(h,s,l){var a=s*Math.min(l,1-l);function f(n){var k=(n+h/30)%12;return 255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)));}return [f(0),f(8),f(4)];}
function hashPal(str){var h=0,i;for(i=0;i<str.length;i++)h=(h*31+str.charCodeAt(i))>>>0;h%=360;
  return [hsl(h,.85,.55),hsl(h+40,.85,.5),hsl(h+190,.8,.55),hsl(h+300,.8,.55),hsl(h+340,.85,.6)];}
function coverPal(url,cb){
  var im=new Image();
  im.onload=function(){
    try{
      var c=document.createElement('canvas');c.width=c.height=4;
      var x=c.getContext('2d');x.drawImage(im,0,0,4,4);
      var d=x.getImageData(0,0,4,4).data,out=[],pts=[0,5,10,15,3],j;
      for(j=0;j<pts.length;j++){
        var p=pts[j],r=d[p*4],g=d[p*4+1],b=d[p*4+2],m=(r+g+b)/3;
        var col=[r,g,b].map(function(v){return Math.max(0,Math.min(255,m+(v-m)*1.7));});
        var mm=(col[0]+col[1]+col[2])/3;
        if(mm<100)col=col.map(function(v){return Math.min(255,v+(100-mm));});
        out.push(col);
      }
      cb(out);
    }catch(e){cb(null);}
  };
  im.onerror=function(){cb(null);};
  im.src=url;
}
function applyPal(k){
  if(mood){setPal(MOODS[mood]);return;}
  if(!k.src){setPal(DEF);return;}
  if(k.pal){setPal(k.pal);return;}
  if(k.cover){
    setPal(hashPal(k.t+k.a));
    if(!k.pb){k.pb=1;coverPal(k.cover,function(p){k.pal=p||hashPal(k.t+k.a);if(tracks[idx]===k&&!mood)setPal(k.pal);});}
  }else{k.pal=hashPal(k.t+k.a);setPal(k.pal);}
}

/* ===== LYRICS (synced, Apple Music style) ===== */
var lyrNodes=[],lyrCur=-1,lyUser=0,lyAn=0,lyrWas=false,wasOff=false,wasOffT=0;
function buildLyr(k){
  var el=$('lyr'),h='',i,L=k.lrc;
  lyrCur=-1;
  if(L){
    el.className='lyx sync al-'+lyAl;
    for(i=0;i<L.length;i++)h+='<div class="ln" data-t="'+L[i].t+'">'+(L[i].s?esc(L[i].s):'♪')+'</div>';
  }else{
    el.className='lyx plain al-'+lyAl;
    h='<div class="pt">'+esc(k.lyrics||'')+'</div>';
  }
  el.innerHTML=h;
  lyrNodes=[].slice.call(el.querySelectorAll('.ln'));
  el.scrollTop=0;
}
function layLyr(){
  var el=$('lyr');
  if(el.className.indexOf('sync')>-1){var p=Math.round(el.clientHeight*.4)+'px';el.style.paddingTop=p;el.style.paddingBottom=p;}
  else{el.style.paddingTop='';el.style.paddingBottom='';}
  updLyr(true,true);
}
function lyScroll(y){
  var el=$('lyr'),y0=el.scrollTop,t0=Date.now(),D=700;
  cancelAnimationFrame(lyAn);
  (function st(){
    var p=Math.min(1,(Date.now()-t0)/D),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    el.scrollTop=y0+(y-y0)*e;
    if(p<1)lyAn=requestAnimationFrame(st);
  })();
}
function updLyr(force,instant){
  var k=tracks[idx],L=k.lrc;
  if(!lyrOn||!L||!lyrNodes.length)return;
  var t=pos+.12,lo=0,hi=L.length-1,a=-1,mid;
  while(lo<=hi){mid=(lo+hi)>>1;if(L[mid].t<=t){a=mid;lo=mid+1;}else hi=mid-1;}
  if(a===lyrCur&&!force)return;
  lyrCur=a;
  var n=lyrNodes,i,d;
  for(i=0;i<n.length;i++){
    d=i-a;
    n[i].className='ln'+(d===0?' on':(Math.abs(d)===1?' d1':(Math.abs(d)===2?' d2':'')));
  }
  var el=$('lyr'),ty=a<0?0:n[a].offsetTop+n[a].offsetHeight/2-el.clientHeight*.4;
  ty=Math.max(0,ty);
  if(instant){cancelAnimationFrame(lyAn);el.scrollTop=ty;}
  else if(Date.now()-lyUser>3500)lyScroll(ty);
}
function syncLyr(){
  var k=tracks[idx],has=!!(k.lyrics||k.lrc),prevOn=lyrWas;
  var sig=String(k.key||idx)+'|'+(k.lrc?k.lrc.length:0)+'|'+(k.lyrics?k.lyrics.length:0),el=$('lyr'),rebuilt=false;
  if(!has)lyrOn=false;
  $('stage').className='stage'+(lyrOn?' lyr':'');
  $('lbtn').className='circ press'+(has?'':' dis')+(lyrOn?' lon':'');
  if(el.getAttribute('data-k')!==sig){buildLyr(k);el.setAttribute('data-k',sig);rebuilt=true;}
  if(lyrOn!==prevOn){if(lyrOn)chromeWake();else chromeReset();}
  if(lyrOn&&(rebuilt||!prevOn))layLyr();
  lyrWas=lyrOn;
}
function setAl(a){
  var i,el,ids2=['lyr','lypv'],bs2=$('alSeg').children;
  lyAl=a;
  try{localStorage.setItem('np_lyal',a);}catch(e){}
  for(i=0;i<ids2.length;i++){el=$(ids2[i]);el.className=el.className.replace(/al-[lcr]/,'al-'+a);}
  for(i=0;i<bs2.length;i++)bs2[i].className=(bs2[i].getAttribute('data-al')===a?'on':'');
  refresh();
}

/* ===== AUDIO FORMAT BADGE ===== */
function extFmt(nm){
  nm=nm.toLowerCase();
  var e=(nm.match(/\.([a-z0-9]+)$/)||[])[1]||'';
  if(e==='flac')return {n:'FLAC',l:true};
  if(e==='wav')return {n:'WAV',l:true};
  if(e==='mp3')return {n:'MP3',l:false};
  if(e==='opus')return {n:'Opus',l:false};
  if(e==='ogg'||e==='oga')return {n:'Vorbis',l:false};
  if(e==='aac')return {n:'AAC',l:false};
  if(e==='m4a'||e==='mp4'||e==='m4b')return {n:'M4A',l:false};
  if(e==='wma')return {n:'WMA',l:false};
  return {n:(e&&e.length<6?e.toUpperCase():'Audio'),l:false};
}
function snap(r){
  var c=[32,48,64,96,112,128,160,192,224,256,320],i;
  for(i=0;i<c.length;i++)if(Math.abs(r-c[i])/c[i]<.03)return c[i];
  return Math.round(r);
}
function calcKbps(k){
  if(!k.fmt||k.fmt.l||k.kbps||!k.file||!k.tagged)return;
  if(tracks[idx]!==k||!(audio.duration>1))return;
  var bytes=k.file.size-(k.over||0);
  if(bytes<=0)return;
  k.kbps=snap(bytes*8/audio.duration/1000);
}
function fmtLabel(k){
  var f=k.fmt,q='';
  if(f.l)q=(f.sr&&f.sr>48000)?'Hi-Res Lossless':'Lossless';
  else if(k.kbps)q=k.kbps+' kbps';
  return f.n+(q?' · '+q:'');
}
function fmtDetail(k){
  var f=k.fmt,a=[f.n];
  if(f.sr)a.push((f.bits?f.bits+'-bit / ':'')+(Math.round(f.sr/100)/10)+' kHz');
  if(f.ch)a.push(f.ch===1?'Mono':f.ch===2?'Stereo':f.ch+' channels');
  if(f.l)a.push(f.sr>48000?'Hi-Res Lossless':'Lossless');
  else a.push('Lossy'+(k.kbps?' · '+k.kbps+' kbps':''));
  return a.join(' · ');
}
function syncFmt(){
  var k=tracks[idx],b=$('fmtb');
  if(!k.src||!k.fmt){b.style.visibility='hidden';return;}
  b.style.visibility='visible';
  b.textContent=fmtLabel(k);
  b.className='fmt press'+(k.fmt.l?' lossless':'');
}

/* ===== PLAYER ===== */
function show(){
  var k=tracks[idx];
  $('title').textContent=k.t;$('artist').textContent=k.a;
  $('artLabel').innerHTML=esc(k.t)+'<small>'+esc(k.a)+'</small>';
  $('heart').className='circ press'+(k.fav?' on':'');
  $('mpT').textContent=k.t;$('mpA').textContent=k.a;
  if(k.cover){art.className='art cover';art.style.backgroundImage='url("'+k.cover+'")';$('mpThumb').style.backgroundImage='url("'+k.cover+'")';}
  else{art.className='art';art.style.backgroundImage='';$('mpThumb').style.backgroundImage='';}
  applyPal(k);syncLyr();syncFmt();
  if(navigator.mediaSession&&window.MediaMetadata){try{navigator.mediaSession.metadata=new MediaMetadata({title:k.t,artist:k.a,artwork:k.cover?[{src:k.cover,sizes:'512x512'}]:[]});}catch(e){}}
  refresh();
}
function paint(){
  var d=dur();
  fill.style.width=(d?Math.min(100,pos/d*100):0)+'%';
  $('cur').textContent=fmt(pos);
  $('rem').textContent=d?'-'+fmt(d-pos):'-0:00';
  if(lyrOn)updLyr();
}
function load(i){
  audio.pause();
  idx=(i+tracks.length)%tracks.length;pos=0;
  var k=tracks[idx];
  if(k.src){audio.src=k.src;if(playing){var p=audio.play();if(p&&p.catch)p.catch(function(){});}}
  show();paint();
}
function setPlaying(p){
  if(p&&gNeeded())audioStart();
  if(p&&ac&&ac.state==='suspended'){try{ac.resume();}catch(e){}}
  playing=p;
  app.className=appCls();
  targetSpeed=p?2.2:1;
  if(tracks[idx].src){
    if(p){var pr=audio.play();if(pr&&pr.catch)pr.catch(function(){playing=false;app.className=appCls();targetSpeed=1;});}
    else audio.pause();
  }
  refresh();
}
function playIndex(i,c){plc=c||null;hist.push(idx);playing=true;load(i);setPlaying(true);}
function nextIdx(auto){
  var o=order(),p=o.indexOf(idx),n;
  if(repeat===2&&auto)return idx;
  if(shuffle&&o.length>1){var r;do{r=o[Math.floor(Math.random()*o.length)];}while(r===idx);return r;}
  n=p+1;
  if(n>=o.length){if(repeat===0&&auto)return -1;n=0;}
  return o[n];
}
function next(auto){
  var n=nextIdx(auto);
  if(n<0){setPlaying(false);load(order()[0]);return;}
  hist.push(idx);if(hist.length>50)hist.shift();
  load(n);
}
function prev(){
  if(pos>3){pos=0;if(tracks[idx].src)audio.currentTime=0;paint();}
  else if(hist.length)load(hist.pop());
  else{var o=order(),p=o.indexOf(idx);load(o[(p-1+o.length)%o.length]);}
}
function syncModes(){
  $('shuf').className='mini press'+(shuffle?' on':'');
  $('rep').className='mini press'+(repeat>0?' on':'');
  $('rep').setAttribute('data-one',repeat===2?'1':'0');
}

/* ===== VOLUME ===== */
function setVol(p){
  vp=Math.min(1,Math.max(0,p));
  try{audio.volume=vp;}catch(e){}
  $('vf').style.width=(vp*100)+'%';
  try{localStorage.setItem('np_vol',String(vp));}catch(e){}
}
try{var sv=localStorage.getItem('np_vol');if(sv!==null){var pv=parseFloat(sv);if(pv===pv)vp=pv;}}catch(e){}

/* ===== LISTS (songs, artists, playlists) ===== */
function rows(list,mode){
  var h='',j,i,k;
  for(j=0;j<list.length;j++){
    i=list[j];k=tracks[i];
    h+='<li class="'+(i===idx?'cur':'')+'" data-i="'+i+'"><span class="n">'+(i===idx&&playing?'♪':(j+1))+'</span><div class="t"><b>'+esc(k.t)+'</b><span>'+esc(k.a)+'</span></div>'+
       (mode==='add'?'<button type="button" class="rb" data-add="'+i+'">+</button>':(mode==='rm'?'<button type="button" class="rb" data-rm="'+i+'">−</button>':''))+'</li>';
  }
  return h;
}
function note(txt){return '<li style="cursor:default"><p class="empty" style="width:100%">'+txt+'</p></li>';}
function drawQueue(){$('qlist').innerHTML=rows(order(),'q');}
function drawSearch(){
  var raw=$('q').value.replace(/^\s+|\s+$/g,''),q=raw.toLowerCase(),box=$('sList');
  if(!q){box.innerHTML=note('Search your songs by title or artist.');return;}
  var l=ids().filter(function(i){return (tracks[i].t+' '+tracks[i].a).toLowerCase().indexOf(q)>-1;});
  box.innerHTML=l.length?rows(l,'add'):note('No songs match “'+esc(raw)+'”.');
}
function artistList(){
  var m={},ord=[],i,k,nm,lk;
  for(i=0;i<tracks.length;i++){
    k=tracks[i];nm=k.a||'Unknown artist';lk=nm.toLowerCase();
    if(!m[lk]){m[lk]={name:nm,ix:[]};ord.push(lk);}
    m[lk].ix.push(i);
  }
  ord.sort();
  return ord.map(function(x){return m[x];});
}
function artistByName(n){var A=artistList(),i;for(i=0;i<A.length;i++)if(A[i].name.toLowerCase()===String(n).toLowerCase())return A[i];return null;}
function avatar(a){
  var c='',i,k,p;
  for(i=0;i<a.ix.length;i++){k=tracks[a.ix[i]];if(k.cover){c=k.cover;break;}}
  if(c)return '<div class="av" style="background-image:url(\''+c+'\')"></div>';
  p=hashPal(a.name);
  return '<div class="av" style="background:linear-gradient(145deg,'+rgb(p[0],1)+','+rgb(p[2],.85)+')">'+esc(a.name.charAt(0).toUpperCase())+'</div>';
}
function plById(id){var i;for(i=0;i<playlists.length;i++)if(playlists[i].id===id)return playlists[i];return null;}
function plIdx(P){
  var out=[],i,j;
  for(j=0;j<P.keys.length;j++)for(i=0;i<tracks.length;i++)if(tracks[i].key===P.keys[j]){out.push(i);break;}
  return out;
}
function savePl(){try{localStorage.setItem('np_pl',JSON.stringify(playlists));}catch(e){}}
function mkPl(name){var P={id:'p'+Date.now()+Math.floor(Math.random()*999),name:name,keys:[]};playlists.push(P);savePl();return P;}
var CHEV='<svg class="chev" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
function acts(extra){
  return '<div class="acts"><button type="button" class="press" data-act="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Play</button>'+
    '<button type="button" class="press" data-act="shuf"><svg viewBox="0 0 24 24" style="fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>Shuffle</button>'+(extra||'')+'</div>';
}
function cnt(n){return n+(n===1?' song':' songs');}
function drawLib(){
  var b=$('libBody'),h='',l,i,A,P;
  $('seg').style.display=libSub?'none':'flex';
  libList=null;
  if(libSub&&libSub.k==='artist'){
    A=artistByName(libSub.v);l=A?A.ix:[];libList=l;
    $('libT').textContent=libSub.v;
    h='<div style="margin:0 0 10px"><button type="button" class="hbtn press" data-act="back">‹ Artists</button></div><p class="sub">'+cnt(l.length)+'</p>';
    h+=l.length?acts()+'<ul class="rows box glass">'+rows(l,'add')+'</ul>':'<p class="empty">No songs.</p>';
  }else if(libSub&&libSub.k==='pl'){
    P=plById(libSub.v);
    if(!P){libSub=null;drawLib();return;}
    l=plIdx(P);libList=l;
    $('libT').textContent=P.name;
    h='<div style="margin:0 0 10px"><button type="button" class="hbtn press" data-act="back">‹ Playlists</button></div><p class="sub">'+cnt(l.length)+(P.keys.length>l.length?' · '+(P.keys.length-l.length)+' not loaded (add those files again)':'')+'</p>';
    h+=acts('<button type="button" class="press" data-act="addsongs">+ Songs</button>');
    h+=l.length?'<ul class="rows box glass">'+rows(l,'rm')+'</ul>':'<p class="empty">This playlist is empty. Tap “+ Songs”.</p>';
    h+='<div style="padding:14px 2px 4px;display:flex"><button type="button" class="hbtn press" data-act="rename" style="margin-right:8px">Rename</button><button type="button" class="hbtn press" data-act="del" style="color:#ff6b6b">Delete playlist</button></div>';
  }else{
    $('libT').textContent='Library';
    if(libTab==='songs'){
      l=ids();
      h=acts('<label class="press" for="dirf">+ Folder</label>')+'<p class="sub">'+cnt(l.length)+'</p><ul class="rows box glass">'+rows(l,'add')+'</ul>';
    }else if(libTab==='fav'){
      l=ids().filter(function(i){return tracks[i].fav;});libList=l;
      h=l.length?acts()+'<p class="sub">'+cnt(l.length)+'</p><ul class="rows box glass">'+rows(l,'add')+'</ul>':'<p class="empty">Tap the heart on Now Playing to add favourites.</p>';
    }else if(libTab==='artists'){
      A=artistList();
      h='<p class="sub">'+A.length+(A.length===1?' artist':' artists')+'</p><ul class="rows box glass">';
      for(i=0;i<A.length;i++)h+='<li data-art="'+esc(A[i].name)+'">'+avatar(A[i])+'<div class="t"><b>'+esc(A[i].name)+'</b><span>'+cnt(A[i].ix.length)+'</span></div>'+CHEV+'</li>';
      h+='</ul>';
    }else{
      h='<button type="button" class="feat glass press" data-act="newpl"><div class="badge" style="background:linear-gradient(145deg,#ff2d6f,#7a2cff);font-size:30px;font-weight:300">+</div><div><b>New playlist</b><span>Make your own mix</span></div></button>';
      if(playlists.length){
        h+='<ul class="rows box glass">';
        for(i=0;i<playlists.length;i++){
          P=playlists[i];l=plIdx(P);
          var cv='',q;for(q=0;q<l.length;q++)if(tracks[l[q]].cover){cv=tracks[l[q]].cover;break;}
          var pp=hashPal(P.name);
          h+='<li data-pl="'+P.id+'"><div class="av sq" style="'+(cv?'background-image:url(\''+cv+'\')':'background:linear-gradient(145deg,'+rgb(pp[0],1)+','+rgb(pp[2],.85)+')')+'">'+(cv?'':'♪')+'</div><div class="t"><b>'+esc(P.name)+'</b><span>'+cnt(P.keys.length)+'</span></div>'+CHEV+'</li>';
        }
        h+='</ul>';
      }else h+='<p class="empty">No playlists yet. Make one for dinner, workouts, anything.</p>';
    }
  }
  b.innerHTML=h;
}
function libAct(a){
  var l=libList,L,s,P;
  if(a==='play'||a==='shuf'){
    L=l||ids();
    if(!L.length){toast('No songs yet');return;}
    shuffle=(a==='shuf');syncModes();
    s=shuffle?L[Math.floor(Math.random()*L.length)]:L[0];
    playIndex(s,l);go('now');return;
  }
  if(a==='back'){libSub=null;drawLib();return;}
  if(a==='newpl'){nameDlg('New playlist','','Create',function(n){mkPl(n);drawLib();});return;}
  P=libSub&&libSub.k==='pl'?plById(libSub.v):null;
  if(!P)return;
  if(a==='addsongs'){pickDlg(P);return;}
  if(a==='rename'){nameDlg('Rename playlist',P.name,'Save',function(n){P.name=n;savePl();drawLib();});return;}
  if(a==='del'){
    openDlg('<h3>Delete “'+esc(P.name)+'”?</h3><p class="sub" style="padding:0 20px 6px">The songs stay in your library.</p><div class="dbt"><button type="button" class="hbtn press" data-d="x">Cancel</button><button type="button" class="hbtn press" data-d="ok" style="background:#ff453a;color:#fff">Delete</button></div>');
    dlgCb=function(){playlists=playlists.filter(function(x){return x!==P;});savePl();closeDlg();libSub=null;drawLib();};
  }
}

/* ===== DIALOGS ===== */
var dlgCb=null,dlgSel=null,dlgSong=-1;
function openDlg(h){$('dcard').innerHTML=h;$('dlg').className='dlg open';}
function closeDlg(){$('dlg').className='dlg';dlgCb=null;}
function nameDlg(title,val,ok,cb){
  openDlg('<h3>'+esc(title)+'</h3><input class="sbox glass" id="dIn" maxlength="40" placeholder="Playlist name" value="'+esc(val)+'" autocomplete="off"><div class="dbt"><button type="button" class="hbtn press" data-d="x">Cancel</button><button type="button" class="hbtn press" data-d="ok" style="background:rgba(255,255,255,.92);color:#2a0a4a">'+esc(ok)+'</button></div>');
  dlgCb=function(){var v=$('dIn').value.replace(/^\s+|\s+$/g,'');if(!v){toast('Enter a name');return;}closeDlg();cb(v);};
  setTimeout(function(){try{$('dIn').focus();}catch(e){}},80);
}
function addToPlDlg(i){
  var k=tracks[i],h='<h3>Add to playlist</h3><ul class="rows dl"><li data-dpl="new"><span class="n">+</span><div class="t"><b>New playlist</b></div></li>',j,P,has;
  for(j=0;j<playlists.length;j++){
    P=playlists[j];has=P.keys.indexOf(k.key)>-1;
    h+='<li data-dpl="'+P.id+'"><span class="n">'+(has?'✓':'♪')+'</span><div class="t"><b>'+esc(P.name)+'</b><span>'+(has?'Already added':cnt(P.keys.length))+'</span></div></li>';
  }
  h+='</ul><div class="dbt"><button type="button" class="hbtn press" data-d="x">Close</button></div>';
  dlgSong=i;openDlg(h);dlgCb=null;
}
function pickDlg(P){
  var h='<h3>Add songs</h3><ul class="rows dl">',i,k;
  dlgSel={};
  P.keys.forEach(function(x){dlgSel[x]=true;});
  for(i=0;i<tracks.length;i++){
    k=tracks[i];
    h+='<li data-dk="'+i+'" class="'+(dlgSel[k.key]?'sel':'')+'"><div class="t"><b>'+esc(k.t)+'</b><span>'+esc(k.a)+'</span></div><span class="ck"></span></li>';
  }
  h+='</ul><div class="dbt"><button type="button" class="hbtn press" data-d="x">Cancel</button><button type="button" class="hbtn press" data-d="ok" style="background:rgba(255,255,255,.92);color:#2a0a4a">Done</button></div>';
  openDlg(h);
  dlgCb=function(){
    var keys=P.keys.filter(function(x){return dlgSel[x];});
    tracks.forEach(function(t){if(dlgSel[t.key]&&keys.indexOf(t.key)<0)keys.push(t.key);});
    P.keys=keys;savePl();closeDlg();drawLib();
  };
}
on('dscrim','click',closeDlg);
on('dcard','click',function(e){
  var t=up(e.target,'data-d');
  if(t){if(t.getAttribute('data-d')==='ok'){if(dlgCb)dlgCb();}else closeDlg();return;}
  t=up(e.target,'data-dpl');
  if(t){
    var v=t.getAttribute('data-dpl'),k=tracks[dlgSong];
    if(v==='new'){
      var kk=k.key;closeDlg();
      nameDlg('New playlist','','Create',function(n){var P=mkPl(n);P.keys.push(kk);savePl();toast('Added to '+n);refresh();});
    }else{
      var P2=plById(v);
      if(P2&&P2.keys.indexOf(k.key)<0){P2.keys.push(k.key);savePl();toast('Added to '+P2.name);}
      else toast('Already in '+(P2?P2.name:'that playlist'));
      closeDlg();refresh();
    }
    return;
  }
  t=up(e.target,'data-dk');
  if(t){var key=tracks[+t.getAttribute('data-dk')].key;dlgSel[key]=!dlgSel[key];t.className=dlgSel[key]?'sel':'';}
});

/* ===== PAGES AND NAVIGATION ===== */
function refresh(){
  if(sheet.className.indexOf('open')>-1)drawQueue();
  if(view==='lib')drawLib();
  if(view==='search')drawSearch();
  var real=!!tracks[0].src,n=order().length,s=[];
  $('queueName').textContent=(real?'Up Next':'Demo queue')+' · '+n+' song'+(n===1?'':'s');
  $('moodSub').textContent=mood||'Auto';
  $('thSub').textContent='Moods · '+(mood||'Auto');
  $('eqSub').textContent=eq.on?(eq.p||'Custom'):'Off';
  if(snd.boost>0)s.push('Boost +'+snd.boost+' dB');
  if(snd.loud)s.push('Loud mode');
  $('sndSub').textContent=s.length?s.join(' · '):'Off';
  $('lySub').textContent='Alignment · '+({l:'Left',c:'Middle',r:'Right'})[lyAl];
}
function fit(){
  var st=$('stage'),w=$('artwrap');if(!st||!w)return;
  var s=Math.min(st.clientWidth-8,st.clientHeight-8,380);
  if(!(s>150))s=Math.max(150,Math.min(st.clientWidth-8,260));
  w.style.width=s+'px';w.style.height=s+'px';
}
var PAGES=['now','browse','radio','lib','search','settings','theme','moods','sound','lyrics','eq'];
function go(name){
  closeQ();closeDlg();
  if(MAIN[name])prevView=name;
  view=name;
  var i,was=eqRun;
  for(i=0;i<PAGES.length;i++){$('v-'+PAGES[i]).className='view'+(PAGES[i]===name?' show':'');}
  if(name==='now'&&lyrOn)chromeWake();else chromeReset();
  var tabs=$('nav').getElementsByTagName('button');
  for(i=0;i<tabs.length;i++){tabs[i].className='tab press'+(tabs[i].getAttribute('data-v')===name?' active':'');}
  eqRun=(name==='eq');
  if(eqRun){eqInit();eqUi();if(!AC)$('eqNote').textContent='This browser does not support the Web Audio equalizer.';if(!was)eqFrame();}
  if(name==='sound')sndUi();
  if(name==='now'){fit();if(lyrOn)layLyr();}
  if(name==='lib')$('libPage').scrollTop=0;
  refresh();
}
function openQ(){
  drawQueue();sheet.className='sheet open';
  var l=$('qlist'),c=l.querySelector('.cur');
  if(c)l.scrollTop=Math.max(0,c.offsetTop-l.clientHeight/2);
}
function closeQ(){sheet.className='sheet';}
function markTiles(){
  var t=$('tiles').children,i;
  for(i=0;i<t.length;i++){var m=t[i].getAttribute('data-m')||null;t[i].className='tile press'+(m===mood?' sel':'');}
}
function rowHit(e,c,after){
  var t=up(e.target,'data-add');
  if(t){addToPlDlg(+t.getAttribute('data-add'));return true;}
  t=up(e.target,'data-i');
  if(t){playIndex(+t.getAttribute('data-i'),c);if(after)after();return true;}
  return false;
}

/* ===== WIRING (each line independent) ===== */
on('play','click',function(){setPlaying(!playing);});
on('next','click',function(){next(false);});
on('prev','click',prev);
on('heart','click',function(){var k=tracks[idx];k.fav=!k.fav;show();});
on('lbtn','click',function(){
  var k=tracks[idx];
  if(!(k.lyrics||k.lrc)){toast('No embedded lyrics in this song');return;}
  lyrOn=!lyrOn;syncLyr();
});
['touchstart','wheel','mousedown'].forEach(function(ev){on('lyr',ev,function(){lyUser=Date.now();cancelAnimationFrame(lyAn);});});
on('lyr','click',function(e){
  if(wasOff&&Date.now()-wasOffT<500){wasOff=false;return;}   /* first tap only brings the controls back */
  var t=up(e.target,'data-t');if(!t)return;
  var s=parseFloat(t.getAttribute('data-t'));
  pos=s;if(tracks[idx].src){try{audio.currentTime=s;}catch(x){}}
  lyUser=0;paint();updLyr(true);
});
/* immersive lyrics: a tap on the lyrics wakes the controls for 3 seconds */
var tapS=null;
on('app','pointerdown',function(e){
  if(!lyrOn||view!=='now')return;
  if(inside(e.target,'lyr'))tapS={x:e.clientX,y:e.clientY,t:Date.now()};
  else if(!chromeOff){clearTimeout(chromeT);chromeT=setTimeout(chromeHide,3000);}
});
on('app','pointerup',function(e){
  if(!tapS)return;
  var s=tapS;tapS=null;
  if(Math.abs(e.clientX-s.x)<10&&Math.abs(e.clientY-s.y)<10&&Date.now()-s.t<500){wasOff=chromeOff;wasOffT=Date.now();chromeWake();}
});
on('app','pointercancel',function(){tapS=null;});
on('fmtb','click',function(){var k=tracks[idx];if(k.fmt)toast(fmtDetail(k));});
on('shuf','click',function(){shuffle=!shuffle;syncModes();});
on('rep','click',function(){repeat=(repeat+1)%3;syncModes();});
on('mpPlay','click',function(e){e.stopPropagation();setPlaying(!playing);});
on('mpNext','click',function(e){e.stopPropagation();next(false);});
on('mp','click',function(){go('now');});
on('qBtn','click',openQ);
on('scrim','click',closeQ);
on('app','click',function(e){
  if(up(e.target,'data-gear')){go('settings');return;}
  var t=up(e.target,'data-go');if(t)go(t.getAttribute('data-go'));
});
on('setDone','click',function(){go(prevView||'now');});
on('nav','click',function(e){var t=up(e.target,'data-v');if(t)go(t.getAttribute('data-v'));});
on('qlist','click',function(e){rowHit(e,plc,closeQ);});
on('sList','click',function(e){rowHit(e,null,function(){go('now');});});
on('q','input',drawSearch);
on('alSeg','click',function(e){var b=up(e.target,'data-al');if(b)setAl(b.getAttribute('data-al'));});
on('seg','click',function(e){
  var b=up(e.target,'data-s');if(!b)return;
  libTab=b.getAttribute('data-s');libSub=null;
  var bs2=$('seg').getElementsByTagName('button'),i;
  for(i=0;i<bs2.length;i++)bs2[i].className=(bs2[i]===b?'on':'');
  drawLib();
});
on('libBody','click',function(e){
  var t=up(e.target,'data-add');
  if(t){addToPlDlg(+t.getAttribute('data-add'));return;}
  t=up(e.target,'data-rm');
  if(t){
    var P=libSub&&libSub.k==='pl'?plById(libSub.v):null,key=tracks[+t.getAttribute('data-rm')].key;
    if(P){P.keys=P.keys.filter(function(x){return x!==key;});savePl();drawLib();toast('Removed from playlist');}
    return;
  }
  t=up(e.target,'data-act');
  if(t){libAct(t.getAttribute('data-act'));return;}
  t=up(e.target,'data-art');
  if(t){libSub={k:'artist',v:t.getAttribute('data-art')};drawLib();$('libPage').scrollTop=0;return;}
  t=up(e.target,'data-pl');
  if(t){libSub={k:'pl',v:t.getAttribute('data-pl')};drawLib();$('libPage').scrollTop=0;return;}
  t=up(e.target,'data-i');
  if(t){playIndex(+t.getAttribute('data-i'),libList);go('now');}
});
on('tiles','click',function(e){
  var t=up(e.target,'data-m');if(!t)return;
  mood=t.getAttribute('data-m')||null;
  applyPal(tracks[idx]);markTiles();refresh();
  toast(mood?'Mood: '+mood:'Colours follow the song');
});
var STATIONS=[
  {n:'Neon Radio',s:'Everything, shuffled',m:null,c:'linear-gradient(145deg,#ff2d6f,#7a2cff)'},
  {n:'Late Night',s:'Slow and dreamy',m:'Night',c:'linear-gradient(145deg,#3c1ea0,#8228c8)'},
  {n:'Sunrise FM',s:'Warm and bright',m:'Sunset',c:'linear-gradient(145deg,#ff5a3c,#ffa03c)'},
  {n:'Deep Forest',s:'Calm and focused',m:'Forest',c:'linear-gradient(145deg,#14b478,#0a786e)'}
];
on('stations','click',function(e){
  var c=up(e.target,'data-st');if(!c)return;
  var s=STATIONS[+c.getAttribute('data-st')];
  mood=s.m;markTiles();shuffle=true;syncModes();
  playIndex(Math.floor(Math.random()*tracks.length),null);
  toast(s.n+' · shuffling your songs');
});
on('clearQ','click',function(){
  var i,k;
  audio.pause();
  for(i=0;i<tracks.length;i++){k=tracks[i];try{if(k.src)URL.revokeObjectURL(k.src);if(k.cover)URL.revokeObjectURL(k.cover);}catch(e){}}
  tagQ=[];
  audio.removeAttribute('src');
  tracks=demo();hist=[];playing=false;lyrOn=false;plc=null;libSub=null;
  setPlaying(false);load(0);closeQ();toast('Queue cleared');
});
audio.addEventListener('loadedmetadata',function(){paint();calcKbps(tracks[idx]);syncFmt();});
audio.addEventListener('ended',function(){next(true);});
audio.addEventListener('play',function(){if(ac&&ac.state==='suspended'){try{ac.resume();}catch(e){}}});
window.addEventListener('resize',function(){fit();sizeBg();if(lyrOn)layLyr();});

/* seek + volume bars */
function seekTo(e){var r=seek.getBoundingClientRect();pos=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))*dur();paint();}
function endDrag(){
  if(!dragging)return;
  dragging=false;seek.className='seek';
  if(tracks[idx].src&&dur())audio.currentTime=pos;
  lyUser=0;
}
seek.addEventListener('pointerdown',function(e){
  dragging=true;seek.className='seek drag';
  try{seek.setPointerCapture(e.pointerId);}catch(_){}
  seekTo(e);
});
seek.addEventListener('pointermove',function(e){if(dragging)seekTo(e);});
seek.addEventListener('pointerup',endDrag);
seek.addEventListener('pointercancel',endDrag);

var vs=$('vs');
function volTo(e){var r=vs.getBoundingClientRect();setVol((e.clientX-r.left)/r.width);}
vs.addEventListener('pointerdown',function(e){
  vdrag=true;vs.className='vs drag';
  try{vs.setPointerCapture(e.pointerId);}catch(_){}
  volTo(e);
});
vs.addEventListener('pointermove',function(e){if(vdrag)volTo(e);});
function vEnd(){vdrag=false;vs.className='vs';}
vs.addEventListener('pointerup',vEnd);
vs.addEventListener('pointercancel',vEnd);

try{if(navigator.mediaSession){
  navigator.mediaSession.setActionHandler('play',function(){setPlaying(true);});
  navigator.mediaSession.setActionHandler('pause',function(){setPlaying(false);});
  navigator.mediaSession.setActionHandler('previoustrack',prev);
  navigator.mediaSession.setActionHandler('nexttrack',function(){next(false);});
}}catch(e){}

/* ===== TAGS, LYRICS AND FORMAT READING ===== */
function rd(f,s,e,cb){
  var r=new FileReader();
  r.onload=function(){cb(r.result);};
  r.onerror=function(){cb(null);};
  try{r.readAsArrayBuffer(f.slice(s,e));}catch(x){cb(null);}
}
function dec(b,e){
  var l='utf-8';
  if(e===0)l='iso-8859-1';
  else if(e===1){
    if(b[0]===254&&b[1]===255){l='utf-16be';b=b.subarray(2);}
    else{l='utf-16le';if(b[0]===255&&b[1]===254)b=b.subarray(2);}
  }else if(e===2)l='utf-16be';
  try{return new TextDecoder(l).decode(b).replace(/\0+$/,'').replace(/\0/g,' / ');}catch(x){return '';}
}
function clean(s){return s.replace(/\r\n?/g,'\n').replace(/^\s+|\s+$/g,'');}
function cleanLyr(s){
  s=clean(s)
    .replace(/\[(?:ar|ti|al|au|by|offset|length|re|ve|tool|#):[^\]]*\]/gi,'')
    .replace(/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g,'')
    .replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g,'')
    .replace(/[ \t]+$/gm,'')
    .replace(/\n{3,}/g,'\n\n');
  return s.replace(/^\s+|\s+$/g,'');
}
function parseLrc(s){
  var re=/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g,out=[],ls=s.replace(/\r\n?/g,'\n').split('\n'),i,j,m,ts,txt;
  for(i=0;i<ls.length;i++){
    ts=[];re.lastIndex=0;
    while((m=re.exec(ls[i]))){ts.push(parseInt(m[1],10)*60+parseInt(m[2],10)+(m[3]?parseInt(m[3],10)/Math.pow(10,m[3].length):0));}
    if(!ts.length)continue;
    txt=ls[i].replace(re,'').replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g,'').replace(/^\s+|\s+$/g,'');
    for(j=0;j<ts.length;j++)out.push({t:ts[j],s:txt});
  }
  if(out.length<2)return null;
  out.sort(function(a,b){return a.t-b.t;});
  return out;
}
function lyrObj(raw){
  var l=parseLrc(raw);
  if(l)return {lrc:l,lyr:l.map(function(x){return x.s;}).join('\n').replace(/^\n+|\n+$/g,'')};
  var p=cleanLyr(raw);
  return p?{lyr:p}:null;
}
function img(u,s,e){
  var b=u.subarray(s,e);
  return URL.createObjectURL(new Blob([b],{type:b[0]===137?'image/png':'image/jpeg'}));
}
function ss(u,p){return ((u[p]&127)<<21)|((u[p+1]&127)<<14)|((u[p+2]&127)<<7)|(u[p+3]&127);}
function skipTerm(u,i,end,e){
  if(e===1||e===2){while(i+1<end&&!(u[i]===0&&u[i+1]===0))i+=2;return i+2;}
  while(i<end&&u[i]!==0)i++;
  return i+1;
}
function parseSylt(u,d,fe){
  var e=u[d],tf=u[d+4];
  if(tf!==2)return null;
  var i=skipTerm(u,d+6,fe,e),arr=[],nl=false,st,raw,tm,out=[],cur=null,j,x;
  while(i<fe-3){
    st=i;i=skipTerm(u,i,fe,e);
    if(i+4>fe)break;
    raw=dec(u.subarray(st,i),e);
    tm=(u[i]*16777216+(u[i+1]<<16)+(u[i+2]<<8)+u[i+3])/1000;i+=4;
    if(raw.charAt(0)==='\n')nl=true;
    arr.push({t:tm,r:raw});
  }
  for(j=0;j<arr.length;j++){
    x=arr[j];
    if(nl){
      if(!cur||x.r.charAt(0)==='\n'){cur={t:x.t,s:''};out.push(cur);}
      cur.s+=x.r.replace(/^\n+/,'');
    }else out.push({t:x.t,s:x.r});
  }
  for(j=0;j<out.length;j++)out[j].s=out[j].s.replace(/^\s+|\s+$/g,'');
  return out.length>1?out:null;
}
function parseID3(buf){
  var u=new Uint8Array(buf),v=new DataView(buf),o={};
  if(u[0]!==73||u[1]!==68||u[2]!==51)return o;
  var ver=u[3],flags=u[5],size=ss(u,6),p=10,end=Math.min(10+size,buf.byteLength);
  if((flags&64)&&ver>2&&p+4<=end)p+=(ver===4?ss(u,p):v.getUint32(p)+4);
  for(;;){
    var id,fs,d;
    if(ver===2){
      if(p+6>end)break;
      id=String.fromCharCode(u[p],u[p+1],u[p+2]);fs=(u[p+3]<<16)|(u[p+4]<<8)|u[p+5];d=p+6;
    }else{
      if(p+10>end)break;
      id=String.fromCharCode(u[p],u[p+1],u[p+2],u[p+3]);fs=(ver===4?ss(u,p+4):v.getUint32(p+4));d=p+10;
    }
    if(!/^[A-Z0-9]{3,4}$/.test(id)||fs<=0||d+fs>end)break;
    var fe=d+fs;
    if(id==='TIT2'||id==='TT2')o.t=clean(dec(u.subarray(d+1,fe),u[d]));
    else if(id==='TPE1'||id==='TP1')o.a=clean(dec(u.subarray(d+1,fe),u[d]));
    else if(id==='USLT'||id==='ULT'){
      var e1=u[d],i1=skipTerm(u,d+4,fe,e1),lo=lyrObj(dec(u.subarray(i1,fe),e1));
      if(lo){if(lo.lrc&&!o.lrc)o.lrc=lo.lrc;if(!o.lyr)o.lyr=lo.lyr;}
    }else if(id==='SYLT'||id==='SLT'){
      var sl=parseSylt(u,d,fe);
      if(sl&&!o.lrc){o.lrc=sl;if(!o.lyr)o.lyr=sl.map(function(x){return x.s;}).join('\n');}
    }else if((id==='APIC'||id==='PIC')&&!o.cover){
      var e2=u[d],i2=d+1;
      if(id==='PIC')i2+=3;
      else{while(i2<fe&&u[i2]!==0)i2++;i2++;}
      i2++;
      i2=skipTerm(u,i2,fe,e2);
      if(i2<fe)o.cover=img(u,i2,fe);
    }
    p=fe;
  }
  return o;
}
function kids(u,s,e){
  var a=[],p=s,dv=new DataView(u.buffer,u.byteOffset,u.byteLength);
  while(p+8<=e){
    var sz=dv.getUint32(p);
    if(sz<8||p+sz>e)break;
    a.push({t:String.fromCharCode(u[p+4],u[p+5],u[p+6],u[p+7]),s:p+8,e:p+sz});
    p+=sz;
  }
  return a;
}
  function kid(u,s,e,t){var a=kids(u,s,e),i;for(i=0;i<a.length;i++)if(a[i].t===t)return a[i];return null;}
function u8(u,s,e){try{return new TextDecoder('utf-8').decode(u.subarray(s,e));}catch(x){return '';}}
function readMoov(u,o){
  var tr=kids(u,8,u.length),i;
  for(i=0;i<tr.length;i++){
    if(tr[i].t!=='trak')continue;
    var md=kid(u,tr[i].s,tr[i].e,'mdia');if(!md)continue;
    var mi=kid(u,md.s,md.e,'minf');if(!mi)continue;
    var sb=kid(u,mi.s,mi.e,'stbl');if(!sb)continue;
    var sd=kid(u,sb.s,sb.e,'stsd');if(!sd)continue;
    var cc=String.fromCharCode(u[sd.s+12],u[sd.s+13],u[sd.s+14],u[sd.s+15]);
    if(cc==='alac'){o.fmt={n:'ALAC',l:true};break;}
    if(cc==='mp4a'){o.fmt={n:'AAC',l:false};break;}
    if(cc==='fLaC'){o.fmt={n:'FLAC',l:true};break;}
    if(cc==='Opus'){o.fmt={n:'Opus',l:false};break;}
    if(cc==='ac-3'){o.fmt={n:'AC-3',l:false};break;}
    if(cc==='ec-3'){o.fmt={n:'E-AC-3',l:false};break;}
  }
  var ud=kid(u,8,u.length,'udta');if(!ud)return;
  var me=kid(u,ud.s,ud.e,'meta');if(!me)return;
  var il=kid(u,me.s+4,me.e,'ilst');if(!il)return;
  var it=kids(u,il.s,il.e),j;
  for(j=0;j<it.length;j++){
    var dt=kid(u,it[j].s,it[j].e,'data');if(!dt)continue;
    var ps=dt.s+8,key=it[j].t;
    if(key==='\u00a9nam')o.t=clean(u8(u,ps,dt.e));
    else if(key==='\u00a9ART')o.a=clean(u8(u,ps,dt.e));
    else if(key==='\u00a9lyr'){var lo=lyrObj(u8(u,ps,dt.e));if(lo){if(lo.lrc)o.lrc=lo.lrc;o.lyr=lo.lyr;}}
    else if(key==='covr'&&!o.cover&&dt.e>ps)o.cover=img(u,ps,dt.e);
  }
}
function mp4(f,cb){
  var size=f.size,o={};
  function find(off,n){
    if(n>24||off+8>size){cb(o);return;}
    rd(f,off,off+16,function(h){
      if(!h||h.byteLength<8){cb(o);return;}
      var v=new DataView(h),sz=v.getUint32(0),ty=String.fromCharCode(v.getUint8(4),v.getUint8(5),v.getUint8(6),v.getUint8(7));
      if(sz===1&&h.byteLength>=16)sz=v.getUint32(12);
      else if(sz===0)sz=size-off;
      if(sz<8){cb(o);return;}
      if(ty==='moov'){
        if(sz>40000000){cb(o);return;}
        o.over=sz;
        rd(f,off,off+sz,function(b){if(b){try{readMoov(new Uint8Array(b),o);}catch(x){}}cb(o);});
      }else find(off+sz,n+1);
    });
  }
  find(0,0);
}
function flac(buf){
  var u=new Uint8Array(buf),dv=new DataView(buf),o={};
  if(u[0]!==102||u[1]!==76||u[2]!==97||u[3]!==67)return o;
  var p=4;
  while(p+4<=u.length){
    var last=u[p]&128,ty=u[p]&127,len=(u[p+1]<<16)|(u[p+2]<<8)|u[p+3],s=p+4;
    if(s+len>u.length)break;
    if(ty===0&&len>=14){
      o.fmt={n:'FLAC',l:true,sr:(u[s+10]<<12)|(u[s+11]<<4)|(u[s+12]>>4),ch:((u[s+12]>>1)&7)+1,bits:(((u[s+12]&1)<<4)|(u[s+13]>>4))+1};
    }else if(ty===4){
      var q=s,vl=dv.getUint32(q,true);q+=4+vl;
      var n=dv.getUint32(q,true);q+=4;
      for(var i=0;i<n&&q+4<=s+len;i++){
        var l=dv.getUint32(q,true);q+=4;
        var str=u8(u,q,q+l);q+=l;
        var eq2=str.indexOf('=');if(eq2<1)continue;
        var k=str.slice(0,eq2).toUpperCase(),val=str.slice(eq2+1);
        if(k==='TITLE')o.t=clean(val);
        else if(k==='ARTIST')o.a=clean(val);
        else if((k==='LYRICS'||k==='UNSYNCEDLYRICS')&&!o.lyr){var lo=lyrObj(val);if(lo){if(lo.lrc)o.lrc=lo.lrc;o.lyr=lo.lyr;}}
      }
    }else if(ty===6&&!o.cover){
      var q2=s+4,ml=dv.getUint32(q2);q2+=4+ml;
      var dl=dv.getUint32(q2);q2+=4+dl+16;
      var pl=dv.getUint32(q2);q2+=4;
      if(q2+pl<=s+len)o.cover=img(u,q2,q2+pl);
    }
    if(last)break;
    p=s+len;
  }
  return o;
}
function wav(buf){
  if(!buf||buf.byteLength<36)return {n:'WAV',l:true};
  var u=new Uint8Array(buf);
  if(u[0]!==82||u[1]!==73||u[2]!==70||u[3]!==70)return {n:'WAV',l:true};
  var dv=new DataView(buf),tag=dv.getUint16(20,true);
  return {n:'WAV',l:(tag===1||tag===3||tag===65534),ch:dv.getUint16(22,true),sr:dv.getUint32(24,true),bits:dv.getUint16(34,true)};
}
function ogg(buf,nm){
  var s='',i;
  if(buf){var u=new Uint8Array(buf);for(i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);}
  if(s.indexOf('OpusHead')>-1)return {n:'Opus',l:false};
  if(s.indexOf('vorbis')>-1)return {n:'Vorbis',l:false};
  if(s.indexOf('FLAC')>-1)return {n:'FLAC',l:true};
  return /\.opus$/.test(nm)?{n:'Opus',l:false}:{n:'Vorbis',l:false};
}
function applyTags(k,m){
  k.tagged=1;
  if(m){
    if(m.t)k.t=m.t;
    if(m.a)k.a=m.a;
    if(m.lyr)k.lyrics=m.lyr;
    if(m.lrc)k.lrc=m.lrc;
    if(m.cover){k.cover=m.cover;k.pal=null;k.pb=0;}
    if(m.fmt)k.fmt=m.fmt;
    if(m.over)k.over=m.over;
  }
  calcKbps(k);
  if(tracks[idx]===k)show();else refresh();
}
/* works out what a file really is from its first bytes, so files with odd or missing names still work */
function sniff(h,nm,ty){
  var u=h?new Uint8Array(h):[],c0=u[0]||0,c1=u[1]||0,s4=String.fromCharCode(c0,c1,u[2]||0,u[3]||0);
  if(s4.slice(0,3)==='ID3')return 'mp3';
  if(s4==='fLaC')return 'flac';
  if(s4==='RIFF')return 'wav';
  if(s4==='OggS')return 'ogg';
  if(u.length>=8&&String.fromCharCode(u[4],u[5],u[6],u[7])==='ftyp')return 'mp4';
  if(c0===255&&(c1&246)===240)return 'aac';
  if(c0===255&&(c1&224)===224)return 'mp3';
  if(c0===48&&c1===38&&u[2]===178&&u[3]===117)return 'wma';
  if(/\.mp3$/.test(nm)||ty==='audio/mpeg')return 'mp3';
  if(/\.(m4a|mp4|m4b)$/.test(nm))return 'mp4';
  if(/\.flac$/.test(nm))return 'flac';
  if(/\.wav$/.test(nm))return 'wav';
  if(/\.(ogg|oga|opus)$/.test(nm))return 'ogg';
  return '';
}
function readTags(k,done){
  var f=k.file,nm=f.name.toLowerCase(),ty=f.type;
  function fin(m){m=m||{};if(!m.fmt)m.fmt=extFmt(nm);try{applyTags(k,m);}catch(e){}done();}
  try{
    rd(f,0,16,function(h){
      var kind=sniff(h,nm,ty);
      try{
        if(kind==='mp3'){
          var u=h?new Uint8Array(h):[];
          if(h&&h.byteLength>=10&&u[0]===73&&u[1]===68&&u[2]===51){
            var tsz=10+ss(u,6);
            rd(f,0,Math.min(tsz,15000000),function(b){var o=b?parseID3(b):{};o.fmt={n:'MP3',l:false};o.over=tsz;fin(o);});
          }else fin({fmt:{n:'MP3',l:false}});
        }else if(kind==='mp4'){
          mp4(f,function(o){if(!o.fmt)o.fmt={n:'M4A',l:false};fin(o);});
        }else if(kind==='flac'){
          rd(f,0,8000000,function(b){var o=b?flac(b):{};if(!o.fmt)o.fmt={n:'FLAC',l:true};fin(o);});
        }else if(kind==='wav'){
          rd(f,0,64,function(b){fin({fmt:wav(b)});});
        }else if(kind==='ogg'){
          rd(f,0,512,function(b){fin({fmt:ogg(b,nm)});});
        }else if(kind==='aac'){fin({fmt:{n:'AAC',l:false}});}
        else if(kind==='wma'){fin({fmt:{n:'WMA',l:false}});}
        else fin(null);
      }catch(e){done();}
    });
  }catch(e){done();}
}
var tagQ=[],tagBusy=false;
function pump(){
  if(tagBusy||!tagQ.length)return;
  tagBusy=true;
  var k=tagQ.shift();
  readTags(k,function(){tagBusy=false;pump();});
}

/* ===== ADDING SONGS (adds to the library, never replaces it) ===== */
function onFiles(){
  var inp=this,fl=inp.files,strict=(inp.id==='dirf');
  if(!fl||!fl.length)return;
  var list=[],i,f,total=fl.length,AUD=/\.(mp3|m4a|m4b|mp4|aac|wav|ogg|oga|flac|opus|wma)$/i;
  for(i=0;i<total;i++){
    f=fl[i];
    if(/^(image|text)\//.test(f.type))continue;     /* accept everything else: names can be odd, we check the bytes later */
    if(strict&&!(/^audio\//.test(f.type)||AUD.test(f.name)))continue;   /* a folder holds other files too */
    list.push(f);
  }
  if(strict)total=list.length;
  if(!list.length){inp.value='';toast(strict?'No audio files found in that folder':'No audio files found');return;}
  list.sort(function(a,b){return a.name<b.name?-1:a.name>b.name?1:0;});

  var wasDemo=!tracks[0].src,seen={},fresh=[],j,key;
  if(wasDemo){tracks=[];hist=[];plc=null;}
  for(j=0;j<tracks.length;j++)seen[tracks[j].key]=1;
  for(i=0;i<list.length;i++){
    f=list[i];
    key=f.name+'|'+f.size+'|'+f.lastModified;
    if(seen[key])continue;
    seen[key]=1;
    var name=f.name.replace(/\.[^.]+$/,''),t=name,a='Unknown artist',m=name.match(/^(.+?)\s+-\s+(.+)$/);
    if(m){a=m[1];t=m[2];}
    fresh.push({t:t||'Untitled',a:a,src:URL.createObjectURL(f),file:f,key:key,fmt:extFmt(f.name)});
  }
  inp.value='';                                      /* reset only after every file has been read */
  if(!fresh.length){toast('Those songs are already in your library');return;}
  tracks=tracks.concat(fresh);
  for(i=0;i<fresh.length;i++)tagQ.push(fresh[i]);
  var msg='Added '+fresh.length+' of '+total+(strict?' songs from folder':' selected')+(wasDemo?'':' · '+tracks.length+' in library');
  if(wasDemo){idx=0;lyrOn=false;playing=true;load(0);setPlaying(true);}
  else refresh();
  toast(msg);
  pump();
}
on('files','change',onFiles);
on('files','input',onFiles);
on('dirf','change',onFiles);
on('dirf','input',onFiles);

/* ===== EQUALIZER + SOUND ENGINE (Web Audio) ===== */
/* chain: boost > 10 EQ bands > loud-mode compressor > makeup gain > limiter > spectrum > speakers */
var AC=window.AudioContext||window.webkitAudioContext,ac=null,pre=null,comp=null,mk=null,lim=null,ana=null,sbuf=null,filt=[],dfilt=[],conn=false,eqRun=false;
var EQF=[31,62,125,250,500,1000,2000,4000,8000,16000],EQL=['31','62','125','250','500','1k','2k','4k','8k','16k'];
var PRE={
  'Flat':[0,0,0,0,0,0,0,0,0,0],
  'Bass Boost':[7,6,5,3,1,0,0,0,0,0],
  'Treble Boost':[0,0,0,0,0,1,3,5,6,7],
  'Vocal':[-2,-2,-1,1,3,4,3,1,0,-1],  'Rock':[5,4,2,-1,-2,-1,2,4,5,5],
  'Pop':[-1,1,3,4,3,0,-1,-1,1,2],
  'Jazz':[3,2,1,2,-2,-2,0,1,3,4],
  'Classical':[4,3,2,1,-1,-1,0,2,3,4],
  'Electronic':[5,4,1,0,-2,2,1,2,4,5],
  'Hip-Hop':[5,4,2,3,-1,-1,2,0,2,3]
};
var eq={on:false,g:[0,0,0,0,0,0,0,0,0,0],p:'Flat'};
var snd={boost:0,loud:false,prot:false,warned:false};
try{var s2=JSON.parse(localStorage.getItem('np_eq')||'null');if(s2&&s2.g&&s2.g.length===10){eq.g=s2.g.map(Number);eq.on=!!s2.on;eq.p=s2.p||'';}}catch(e){}
try{var s3=JSON.parse(localStorage.getItem('np_snd')||'null');if(s3){snd.boost=Math.max(0,Math.min(12,Math.round(+s3.boost||0)));snd.loud=!!s3.loud;snd.prot=!!s3.prot;}}catch(e){}
function eqSave(){try{localStorage.setItem('np_eq',JSON.stringify(eq));}catch(e){}}
function sndSave(){try{localStorage.setItem('np_snd',JSON.stringify({boost:snd.boost,loud:snd.loud,prot:snd.prot}));}catch(e){}}
function gNeeded(){return eq.on||snd.boost>0||snd.loud;}
function mkF(i){
  var f=ac.createBiquadFilter();
  f.type=i===0?'lowshelf':(i===9?'highshelf':'peaking');
  f.frequency.value=EQF[i];f.Q.value=1.1;f.gain.value=0;
  return f;
}
function eqInit(){
  if(ac)return true;
  if(!AC)return false;
  try{
    ac=new AC();pre=ac.createGain();
    for(var i=0;i<10;i++){filt.push(mkF(i));dfilt.push(mkF(i));}
    comp=ac.createDynamicsCompressor();comp.knee.value=24;comp.attack.value=.01;comp.release.value=.25;
    mk=ac.createGain();
    lim=ac.createDynamicsCompressor();lim.knee.value=0;lim.attack.value=.002;lim.release.value=.12;
    ana=ac.createAnalyser();ana.fftSize=2048;ana.smoothingTimeConstant=.82;
    sbuf=new Uint8Array(ana.frequencyBinCount);
    return true;
  }catch(e){ac=null;return false;}
}
function eqConnect(){
  if(conn||!ac)return;
  try{
    var s=ac.createMediaElementSource(audio),i;
    s.connect(pre);pre.connect(filt[0]);
    for(i=0;i<9;i++)filt[i].connect(filt[i+1]);
    filt[9].connect(comp);comp.connect(mk);mk.connect(lim);lim.connect(ana);ana.connect(ac.destination);
    conn=true;
  }catch(e){fail(e);}
}
function sp(p,v){try{p.setTargetAtTime(v,ac.currentTime,.03);}catch(e){p.value=v;}}
function audioApply(){
  var i,mx=0,g,on=gNeeded(),db;
  for(i=0;i<10;i++){
    g=eq.on?eq.g[i]:0;
    if(g>mx)mx=g;
    if(filt[i])sp(filt[i].gain,g);
    if(dfilt[i])dfilt[i].gain.value=eq.g[i];
  }
  db=snd.boost-((eq.on&&snd.prot)?mx*.7:0);
  if(pre)sp(pre.gain,Math.pow(10,db/20));
  if(comp){comp.threshold.value=snd.loud?-30:0;comp.ratio.value=snd.loud?4:1;}
  if(mk)sp(mk.gain,snd.loud?Math.pow(10,5/20):1);
  if(lim){lim.threshold.value=on?-1:0;lim.ratio.value=on?20:1;}
  eqSave();sndSave();
}
  function audioStart(){
  if(!eqInit())return false;
  eqConnect();
  try{if(ac.state==='suspended')ac.resume();}catch(e){}
  audioApply();
  return true;
}
function eqEnsure(){
  if(eq.on)return;
  if(audioStart())eq.on=true;
  else toast('Equalizer is not supported on this browser');
}
function eqUi(){
  var i,g,top,f,h,c=$('chips').children;
  $('eqSw').className='sw'+(eq.on?' on':'');
  for(i=0;i<10;i++){
    g=eq.g[i];top=(1-(g+12)/24)*100;
    h=$('eh'+i);f=$('ef'+i);if(!h||!f)continue;
    h.style.top=top+'%';
    if(g>=0){f.style.top=top+'%';f.style.height=(50-top)+'%';}
    else{f.style.top='50%';f.style.height=(top-50)+'%';}
    $('ev'+i).textContent=(g>0?'+':'')+g;
  }
  for(i=0;i<c.length;i++)c[i].className='chip press'+(c[i].getAttribute('data-p')===eq.p?' sel':'');
  $('eqst').textContent=eq.on?(eq.p||'Custom'):'Off';
  $('eqSub').textContent=eq.on?(eq.p||'Custom'):'Off';
}
function bandSet(el,e){
  var r=el.getBoundingClientRect(),f=1-(e.clientY-r.top)/r.height,g=Math.round((f*24-12)*2)/2,i=+el.getAttribute('data-b');
  g=Math.max(-12,Math.min(12,g));
  if(Math.abs(g)<.4)g=0;
  eq.g[i]=g;eq.p='';
  eqEnsure();audioApply();eqUi();
}
on('eqSw','click',function(){
  if(!eq.on){eqEnsure();}else eq.on=false;
  audioApply();eqUi();
});
on('eqReset','click',function(){eq.g=PRE.Flat.slice();eq.p='Flat';audioApply();eqUi();});
on('chips','click',function(e){
  var t=up(e.target,'data-p');if(!t)return;
  var n=t.getAttribute('data-p');
  eq.g=PRE[n].slice();eq.p=n;
  if(n!=='Flat')eqEnsure();
  audioApply();eqUi();
});
var EQFR=new Float32Array(96),EQM=new Float32Array(96),EQP=new Float32Array(96),EQT=new Float32Array(96);
(function(){for(var i=0;i<96;i++)EQFR[i]=20*Math.pow(1000,i/95);})();
function xp(f,w){return Math.log(f/20)/Math.log(1000)*w;}
function eqDraw(){
  var c=$('eqc'),w=c.clientWidth,h=c.clientHeight;
  if(!w||!h)return;
  var dpr=Math.min(2,window.devicePixelRatio||1);
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
  var x=c.getContext('2d'),i,j;
  x.setTransform(dpr,0,0,dpr,0,0);
  x.clearRect(0,0,w,h);
  var mid=h/2,sc=(h/2-14)/15;
  x.lineWidth=1;
  [-12,-6,0,6,12].forEach(function(db){
    x.strokeStyle=db===0?'rgba(255,255,255,.28)':'rgba(255,255,255,.08)';
    x.beginPath();x.moveTo(0,mid-db*sc);x.lineTo(w,mid-db*sc);x.stroke();
  });
  if(ana&&conn){
    try{ana.getByteFrequencyData(sbuf);}catch(e){}
    var N=44,nyq=ac.sampleRate/2,len=sbuf.length,g=x.createLinearGradient(0,h,0,0);
    g.addColorStop(0,'rgba(255,45,111,.55)');g.addColorStop(1,'rgba(42,168,255,.12)');
    x.fillStyle=g;
    for(j=0;j<N;j++){
      var f0=20*Math.pow(1000,j/N),f1=20*Math.pow(1000,(j+1)/N);
      var b0=Math.floor(f0/nyq*len),b1=Math.max(b0+1,Math.ceil(f1/nyq*len)),s=0,n=0;
      for(i=b0;i<b1&&i<len;i++){s+=sbuf[i];n++;}
      var v=n?s/n/255:0,bh=Math.pow(v,1.3)*h*.9,bx=xp(f0,w);
      x.fillRect(bx+1,h-bh,Math.max(2,xp(f1,w)-bx-2),bh);
    }
  }
  for(i=0;i<96;i++)EQT[i]=1;
  if(dfilt.length){
    for(j=0;j<10;j++){dfilt[j].getFrequencyResponse(EQFR,EQM,EQP);for(i=0;i<96;i++)EQT[i]*=EQM[i];}
  }
  x.globalAlpha=eq.on?1:.4;
  x.beginPath();
  for(i=0;i<96;i++){
    var db2=Math.max(-15,Math.min(15,20*Math.log(EQT[i])/Math.LN10)),px=xp(EQFR[i],w),py=mid-db2*sc;
    if(i)x.lineTo(px,py);else x.moveTo(px,py);
  }
  var st=x.createLinearGradient(0,0,w,0);
  st.addColorStop(0,'#ff2d6f');st.addColorStop(.5,'#9b4dff');st.addColorStop(1,'#2aa8ff');
  x.shadowColor='rgba(255,45,111,.7)';x.shadowBlur=14;
  x.strokeStyle=st;x.lineWidth=3;x.lineJoin='round';x.stroke();
  x.shadowBlur=0;
  x.lineTo(w,mid);x.lineTo(0,mid);x.closePath();
  var fg=x.createLinearGradient(0,0,0,h);
  fg.addColorStop(0,'rgba(255,45,111,.22)');fg.addColorStop(1,'rgba(42,168,255,.06)');
  x.fillStyle=fg;x.fill();
  x.globalAlpha=1;
}
function eqFrame(){if(!eqRun)return;try{eqDraw();}catch(e){}requestAnimationFrame(eqFrame);}

/* ===== SOUND PAGE (volume boost, loud mode, equalizer headroom) ===== */
function sndUi(){
  $('bstV').textContent=snd.boost>0?'+'+snd.boost+' dB':'Off';
  $('bstf').style.width=(snd.boost/12*100)+'%';
  $('loudSw').className='sw'+(snd.loud?' on':'');
  $('protSw').className='sw'+(snd.prot?' on':'');
  if(!AC)$('sndNote').textContent='This browser does not support Web Audio, so boost, loud mode and the equalizer will not work.';
}
  function sndChange(){
  if(gNeeded()&&!audioStart()&&!snd.warned){snd.warned=true;toast('Sound effects are not supported here');}
  audioApply();sndUi();refresh();
}
var bs=$('bst');
function bstTo(e){
  var r=bs.getBoundingClientRect();
  snd.boost=Math.round(Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))*12);
  sndChange();
}
bs.addEventListener('pointerdown',function(e){
  bdrag=true;bs.className='vs bst drag';
  try{bs.setPointerCapture(e.pointerId);}catch(_){}
  bstTo(e);
});
bs.addEventListener('pointermove',function(e){if(bdrag)bstTo(e);});
function bEnd(){bdrag=false;bs.className='vs bst';}
bs.addEventListener('pointerup',bEnd);
bs.addEventListener('pointercancel',bEnd);
on('loudSw','click',function(){snd.loud=!snd.loud;sndChange();});
on('protSw','click',function(){snd.prot=!snd.prot;sndChange();});

/* ===== BUILD STATIC PAGES ===== */
try{
  var GEAR='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';
  var gb=document.querySelectorAll('.gbtn'),gi;
  for(gi=0;gi<gb.length;gi++)gb[gi].innerHTML=GEAR;
  /* Apple Music style lyrics icon: speech bubble with quotation marks */
  var QI='<svg viewBox="0 0 24 24"><path d="M5 3h14a3 3 0 013 3v9a3 3 0 01-3 3h-6l-4.5 3.5V18H5a3 3 0 01-3-3V6a3 3 0 013-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7.5 8H10.5V10.4C10.5 11.7 9.8 12.6 8.6 13L8.1 12.2C8.7 11.9 9 11.5 9 11H7.5Z" fill="currentColor"/><path d="M12.5 8H15.5V10.4C15.5 11.7 14.8 12.6 13.6 13L13.1 12.2C13.7 11.9 14 11.5 14 11H12.5Z" fill="currentColor"/></svg>';
  var qi=document.querySelectorAll('.qico'),qj;
  for(qj=0;qj<qi.length;qj++)qi[qj].innerHTML=QI;
}catch(e){fail(e);}
try{
  var h='<button type="button" class="tile press" data-m="" style="background:linear-gradient(145deg,#ff2d6f,#7a2cff,#2aa8ff)">Auto</button>',n;
  for(n in MOODS){if(MOODS.hasOwnProperty(n)){
    h+='<button type="button" class="tile press" data-m="'+n+'" style="background:linear-gradient(145deg,'+rgb(MOODS[n][0],1)+','+rgb(MOODS[n][1],.8)+')">'+n+'</button>';
  }}
  $('tiles').innerHTML=h;markTiles();
  var sh='',j2;
  for(j2=0;j2<STATIONS.length;j2++){
    sh+='<button type="button" class="card glass press" data-st="'+j2+'"><div class="badge" style="background:'+STATIONS[j2].c+'"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div><div><b>'+STATIONS[j2].n+'<span class="live" style="display:inline;margin-top:0;color:#fff">LIVE</span></b><span>'+STATIONS[j2].s+'</span></div></button>';
  }
  $('stations').innerHTML=sh;
}catch(e){fail(e);}
try{
  var bh='',bi;
  for(bi=0;bi<10;bi++)bh+='<div class="eb"><span class="ebv" id="ev'+bi+'">0</span><div class="ebt" data-b="'+bi+'"><div class="ebz"></div><div class="ebf" id="ef'+bi+'"></div><div class="ebh" id="eh'+bi+'"></div></div><span class="ebl">'+EQL[bi]+'</span></div>';
  $('bands').innerHTML=bh;
  var bts=$('bands').querySelectorAll('.ebt');
  [].forEach.call(bts,function(el){
    var d=false;
    el.addEventListener('pointerdown',function(e){d=true;try{el.setPointerCapture(e.pointerId);}catch(_){}bandSet(el,e);});
    el.addEventListener('pointermove',function(e){if(d)bandSet(el,e);});
    el.addEventListener('pointerup',function(){d=false;});
    el.addEventListener('pointercancel',function(){d=false;});
  });
  var ch='',pn;
  for(pn in PRE){if(PRE.hasOwnProperty(pn))ch+='<button type="button" class="chip press" data-p="'+pn+'">'+pn+'</button>';}
  $('chips').innerHTML=ch;
  eqUi();sndUi();
}catch(e){fail(e);}

/* ===== LIQUID BACKGROUND (isolated so it can never break the UI) ===== */
var cv=$('bg'),ctx=null,W=80,H=80,TAU=Math.PI*2;
function sizeBg(){if(!cv)return;W=cv.width=Math.max(80,Math.round(cv.clientWidth*.25));H=cv.height=Math.max(80,Math.round(cv.clientHeight*.25));}
function drawBlob(b,t){
  var cx=(b.x+Math.sin(t*b.sx+b.px)*b.ax)*W,cy=(b.y+Math.cos(t*b.sy+b.py)*b.ay)*H;
  var base=b.r*Math.max(W,H)*.5*(1+.08*Math.sin(t*.35+b.wob));
  var g=ctx.createRadialGradient(cx,cy,0,cx,cy,base*1.5);
  g.addColorStop(0,rgb(b.cur,1));g.addColorStop(.6,rgb(b.cur,.55));g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g;ctx.beginPath();
  for(var i=0;i<=28;i++){
    var a=i/28*TAU,rr=base*(1+.16*Math.sin(a*2+t*.5+b.wob)+.1*Math.sin(a*3-t*.4+b.px));
    var x=cx+Math.cos(a)*rr*1.25,y=cy+Math.sin(a)*rr;
    if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);
  }
  ctx.closePath();ctx.fill();
}
function startBg(){
  ctx=cv.getContext('2d');sizeBg();
  for(var i=0;i<5;i++){
    blobs.push({x:Math.random(),y:Math.random(),r:.42+Math.random()*.22,ax:.12+Math.random()*.2,ay:.12+Math.random()*.2,
      sx:.06+Math.random()*.09,sy:.05+Math.random()*.09,px:Math.random()*6.28,py:Math.random()*6.28,wob:Math.random()*6.28,
      cur:DEF[i].slice(),tgt:DEF[i].slice()});
  }
  var speed=1,clock=0,last=Date.now();
  (function frame(){
    var now=Date.now(),dt=Math.min(.05,(now-last)/1000);last=now;
    speed+=(targetSpeed-speed)*Math.min(1,dt*2);clock+=dt*speed;
    var k=Math.min(1,dt*1.4);
    ctx.globalCompositeOperation='source-over';ctx.fillStyle='#14061f';ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation='screen';
    for(var i=0;i<blobs.length;i++){
      var b=blobs[i];
      for(var j=0;j<3;j++)b.cur[j]+=(b.tgt[j]-b.cur[j])*k;
      drawBlob(b,clock);
    }
    requestAnimationFrame(frame);
  })();
}

/* progress ticker */
var lastT=Date.now();
(function tick(){
  var now=Date.now(),dt=(now-lastT)/1000;lastT=now;
  if(playing&&!dragging){
    var k=tracks[idx];
    if(k.src)pos=audio.currentTime;
    else{pos+=dt;if(pos>=k.d)next(true);}
    paint();
  }
  requestAnimationFrame(tick);
})();

/* ===== START ===== */
try{setVol(vp);}catch(e){fail(e);}
try{setAl(lyAl);}catch(e){fail(e);}
try{load(0);}catch(e){fail(e);}
try{fit();setTimeout(fit,100);}catch(e){fail(e);}
try{startBg();setPal(DEF);}catch(e){fail(e);}
})();