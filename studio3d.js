/* ==================== 3D 个人画室 · Atelier 3D ====================
 * Three.js 程序化建模的一间画室：窗光、画架、静物台、调色台。
 * 颜料按 Kubelka-Munk 减色法混合；画布有颜色 / 厚度 / 湿度三层贴图，
 * 湿画法会互相带色，厚涂在侧光下真的凸起，晾干变哑光，上光油变亮。
 * 完整流程：刷底料 → 构图 → 挤颜料 → 有色底 → 起形 → 单色底层 →
 *          铺大色 → 塑造 → 高光厚涂 → 晾干罩染 → 上光油 → 签名装框挂墙。
 */
(function(){
"use strict";

const root = document.getElementById("atelier3d");
if(!root) return;

/* ---------- 颜料（与 2D 画室的大师色同源） ---------- */
const PIGMENTS = [
  {name:"钛白",       en:"Titanium White",   hex:"#f5f2ea"},
  {name:"那不勒斯黄", en:"Naples Yellow",    hex:"#e8c96a"},
  {name:"镉黄",       en:"Cadmium Yellow",   hex:"#f0b21c"},
  {name:"土黄",       en:"Yellow Ochre",     hex:"#c48a2c"},
  {name:"朱砂红",     en:"Vermilion",        hex:"#c8372a"},
  {name:"深茜红",     en:"Alizarin Crimson", hex:"#7a1c27"},
  {name:"熟赭",       en:"Burnt Sienna",     hex:"#8a4a26"},
  {name:"熟褐",       en:"Burnt Umber",      hex:"#4e3320"},
  {name:"翠绿",       en:"Viridian",         hex:"#1f6a4e"},
  {name:"群青",       en:"Ultramarine",      hex:"#26398c"},
  {name:"普鲁士蓝",   en:"Prussian Blue",    hex:"#1a2a44"},
  {name:"象牙黑",     en:"Ivory Black",      hex:"#211d1a"},
];
PIGMENTS.forEach(p=>{ p.rgb = hexRgb(p.hex); });

const TOOLS = {
  round:   {name:"圆头笔", icon:"🖌️", tip:"勾线、起形、细节"},
  flat:    {name:"平头笔", icon:"▬",  tip:"铺大色、方笔触塑造"},
  filbert: {name:"榛形笔", icon:"🥄", tip:"肖像与静物的万能笔，边缘柔和"},
  fan:     {name:"扇形笔", icon:"🪶", tip:"轻扫过渡、树叶与毛发质感"},
  soft:    {name:"软毛调和笔", icon:"🌫️", tip:"不蘸颜料，揉开湿颜料的边缘（sfumato）"},
  knife:   {name:"调色刀", icon:"🔪", tip:"在调色板上调色；在画布上厚涂"},
};
const BRISTLE_RGB = [214,196,158];

/* ---------- 作画流程 ---------- */
const STAGES = [
  {t:"绷画布 · 刷底料", en:"Priming",
   d:"画布刚绷上内框，还是生亚麻色。先刷石膏底料（gesso）封住纤维——不刷底，油会被麻布吸走，画面发暗还会腐蚀纤维。",
   actions:[["gesso","🖌 刷两遍石膏底料"]]},
  {t:"选题 · 构图", en:"Composition",
   d:"窗下摆好了一组静物：陶罐、酒瓶、苹果、梨和柠檬，阳光从左上方斜射进来。眯起眼睛，只看亮、中、暗三大块。也可以上传参考图，夹在画架旁边。",
   actions:[["ref","🖼 上传参考图"],["refClear","移除参考图"]]},
  {t:"挤颜料 · 布置调色板", en:"Setting the Palette",
   d:"颜料按从浅到深挤在调色板边缘：白、黄、红、棕、绿、蓝、黑。中间留空用来调色。点左侧颜料管，或在调色台上直接点 3D 颜料管。",
   actions:[["squeezeAll","🎨 一键挤好常用色"],["mode:palette","去调色台调色"]]},
  {t:"有色底 · Imprimatura", en:"Toned Ground",
   d:"调色刀挑一点熟赭（可加一点点熟褐），在调色板中间推开；用平头笔蘸取，把稀释度调高，薄薄铺满整张画布。暖棕底能统一画面，也让中间调更好判断。",
   actions:[["tone","🟤 用笔上的颜色快速铺底"]], preset:{tool:"flat", size:60, thin:80}},
  {t:"起形 · Drawing", en:"Drawing",
   d:"小圆头笔蘸稀释的熟褐，轻轻定出每个物体的位置、大小和轮廓。先找比例，不画细节；画错了直接用布擦掉（撤销）。",
   preset:{tool:"round", size:5, thin:65}},
  {t:"单色底层 · Dead Colouring", en:"Underpainting",
   d:"只用熟褐和白，调出深、中、浅几个明度，把暗部和投影铺出来。明暗关系对了，画就成功了一半。",
   preset:{tool:"flat", size:22, thin:45}},
  {t:"铺大色块 · Block-in", en:"Block-in",
   d:"从背景到前景、从暗到亮，用平头笔铺出每块固有色。底层薄、上层厚：越往后，稀释度越低、颜料越厚。别在一个地方磨，整体推进。",
   preset:{tool:"flat", size:28, thin:22}},
  {t:"塑造 · Modelling", en:"Wet-in-wet",
   d:"趁颜料还湿（画面发亮的地方），在明暗交界处来回轻扫，颜色会在画布上自然交融。最后用软毛调和笔揉开边缘——达·芬奇的 sfumato。",
   preset:{tool:"filbert", size:14, thin:18}},
  {t:"高光与细节 · Impasto", en:"Highlights",
   d:"最亮的高光用调色刀或小笔挑浓颜料点上去。厚涂在窗光下会真的凸起来——拖动视角从侧面看看笔触的起伏。",
   preset:{tool:"knife", size:12, thin:0}},
  {t:"晾干 · 罩染", en:"Glazing",
   d:"等颜料干透（这里可以快进三天，画面会从湿亮变成哑光），再用大量稀释的透明色（深茜红、群青）薄罩一层，让暗部更深、色彩更沉。",
   actions:[["dry","⏳ 晾干（快进三天）"]], preset:{tool:"flat", size:40, thin:90}},
  {t:"上光油 · Varnish", en:"Varnish",
   d:"油画干透半年后上光油：保护画面不受灰尘和紫外线侵害，也让变哑的颜色重新饱满透亮。",
   actions:[["varnish","✨ 刷上光油"]]},
  {t:"签名 · 装框 · 挂墙", en:"Sign & Hang",
   d:"在右下角签上名字，装进金色画框，挂到画室的墙上。挂好的作品会一直留在这间画室里。",
   actions:[["sign","✍ 签名"],["frame","🖼 装框 / 取下画框"],["hang","🏛 挂到墙上"]], sign:true},
];

/* ---------- 工具函数 ---------- */
function hexRgb(h){ h=h.replace("#",""); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function rgbHex(c){ return "#"+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join(""); }
function rgba(c,a){ return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${a})`; }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function makeCanvas(w,h){ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; }

/* ---------- 颜料混合：Kubelka-Munk 减色模型 ----------
 * 每个通道把反射率换成 K/S（吸收/散射），按散射力加权平均后再换回。
 * 浅色颜料（尤其钛白）散射强、遮盖力大，深色颜料着色力强。
 * 于是 群青+镉黄 → 绿，红+白 → 粉，而不是 RGB 平均出来的灰。 */
const LIN = new Float32Array(256), KS = new Float32Array(256);
for(let i=0;i<256;i++){
  const c=i/255, l = c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
  LIN[i]=l; const R=Math.max(l,0.003); KS[i]=(1-R)*(1-R)/(2*R);
}
function linByte(l){ l=clamp(l,0,1); return Math.round(255*(l<=0.0031308?12.92*l:1.055*Math.pow(l,1/2.4)-0.055)); }
function scatter(r,g,b){ return 0.4 + 2.6*(0.2126*LIN[r]+0.7152*LIN[g]+0.0722*LIN[b]); }
function mixPaint(a,b,t){
  if(t<=0) return [a[0]|0,a[1]|0,a[2]|0];
  if(t>=1) return [b[0]|0,b[1]|0,b[2]|0];
  const a0=a[0]|0,a1=a[1]|0,a2=a[2]|0,b0=b[0]|0,b1=b[1]|0,b2=b[2]|0;
  const sa=scatter(a0,a1,a2)*(1-t), sb=scatter(b0,b1,b2)*t, S=sa+sb;
  const inv=k=>1+k-Math.sqrt(k*k+2*k);
  return [
    linByte(inv((KS[a0]*sa+KS[b0]*sb)/S)),
    linByte(inv((KS[a1]*sa+KS[b1]*sb)/S)),
    linByte(inv((KS[a2]*sa+KS[b2]*sb)/S)),
  ];
}
function nearestPigment(rgb){
  let best=null, bd=1e9;
  PIGMENTS.forEach(p=>{ const d=(p.rgb[0]-rgb[0])**2+(p.rgb[1]-rgb[1])**2+(p.rgb[2]-rgb[2])**2; if(d<bd){bd=d;best=p;} });
  return bd<900 ? best : null;
}

/* ---------- 界面骨架 ---------- */
root.innerHTML = `
  <div id="a3Side">
    <div class="tool-section">
      <h3>作画流程 · THE PROCESS</h3>
      <ol id="a3Stages"></ol>
      <div id="a3StageCard"></div>
    </div>
    <div class="tool-section">
      <h3>工 具 · TOOLS</h3>
      <div class="brush-grid" id="a3Tools"></div>
      <label class="slider-label"><span>笔刷大小</span><span id="a3SizeVal">16</span></label>
      <input type="range" id="a3Size" min="2" max="90" value="16">
      <label class="slider-label"><span>稀释度（调和油）</span><span id="a3ThinVal">25%</span></label>
      <input type="range" id="a3Thin" min="0" max="100" value="25">
      <div class="a3-note">0% 管装原色·厚涂 ←→ 100% 稀薄透明·罩染</div>
    </div>
    <div class="tool-section">
      <h3>颜 料 管 · TUBES</h3>
      <div id="a3Tubes"></div>
      <div class="a3-note">点一下＝挤一坨到调色板边缘</div>
    </div>
    <div class="tool-section">
      <h3>清 洁 · CLEAN UP</h3>
      <div class="a3-grid2">
        <button class="action-btn" data-act="wash">🫙 洗笔</button>
        <button class="action-btn" data-act="wipe">🧽 擦调色刀</button>
        <button class="action-btn" data-act="scrape" style="grid-column:1/-1">🧹 刮净调色板中间</button>
      </div>
    </div>
    <div class="tool-section">
      <h3>画 布 · CANVAS</h3>
      <div class="a3-grid2">
        <button class="action-btn" data-act="undo">↩ 撤销</button>
        <button class="action-btn" data-act="dry">⏳ 晾干</button>
        <button class="action-btn" data-act="save">💾 存 PNG</button>
        <button class="action-btn danger" data-act="new">🆕 新画布</button>
      </div>
    </div>
    <div class="tool-section">
      <h3>光 线 · LIGHT</h3>
      <div class="a3-grid2">
        <button class="action-btn active" data-light="day">☀ 午后窗光</button>
        <button class="action-btn" data-light="night">🕯 夜晚灯下</button>
      </div>
    </div>
  </div>
  <div id="a3View">
    <div id="a3Modes">
      <button data-mode="roam">🚶 漫游画室 <kbd>1</kbd></button>
      <button data-mode="paint">🖌 站到画架前 <kbd>2</kbd></button>
      <button data-mode="palette">🎨 调色台 <kbd>3</kbd></button>
    </div>
    <div id="a3Load"><span id="a3LoadSw"></span><div><div id="a3LoadName">圆头笔 · 干净</div><div id="a3LoadBar"><i></i></div></div></div>
    <div id="a3Tip"></div>
    <div id="a3Hint"></div>
    <div id="a3Toast"></div>
    <div id="a3Loading"><div class="pulse-dot"></div>正在搭建你的画室……</div>
  </div>`;
const $ = id => document.getElementById(id);
const view = $("a3View");

/* ---------- 入口：等 Three.js（CDN 模块）就绪后再搭场景 ---------- */
let started=false, visible=false, api=null;
window.__atelier3dShow = function(){
  visible = true;
  if(!started){
    started = true;
    const go = ()=>{ try{ api = init(window.THREE3D); }catch(err){ console.error(err); $("a3Loading").innerHTML = "画室搭建失败：" + err.message; } };
    if(window.THREE3D) go();
    else{
      window.addEventListener("three-ready", go, {once:true});
      setTimeout(()=>{ if(!window.THREE3D) $("a3Loading").innerHTML = "⚠️ Three.js 没有加载成功。3D 画室需要联网从 jsDelivr 获取 Three.js，请检查网络后刷新。"; }, 15000);
    }
  } else if(api) api.resume();
};
window.__atelier3dHide = function(){ visible = false; };
window.__atelier3dSetReference = function(url){ pendingRef = url; if(api) api.setReference(url); };
let pendingRef = null;

/* =================================================================== */
function init(T){
const { THREE, OrbitControls, RoomEnvironment, RectAreaLightUniformsLib } = T;
RectAreaLightUniformsLib.init();

/* ---------- 渲染器 / 场景 / 相机 ---------- */
const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;   // 比 ACES 更忠实于颜料本色
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
view.prepend(renderer.domElement);
renderer.domElement.id = "a3Canvas";
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.background = new THREE.Color("#2a241d");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.28;

const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 40);
camera.position.set(2.7, 1.9, 3.3);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-0.25, 1.1, 0.1);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.6;
controls.maxDistance = 4.4;
controls.maxPolarAngle = Math.PI*0.53;
controls.update();

/* ---------- 程序化贴图 ---------- */
function canvasTex(w,h,draw,opt={}){
  const c = makeCanvas(w,h); draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if(opt.srgb!==false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if(opt.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opt.repeat[0],opt.repeat[1]); }
  return t;
}
function grain(ctx,w,h,R,n,dark,light,amp){
  for(let g=0; g<n; g++){
    const y0=R()*h;
    ctx.strokeStyle = R()<0.55 ? rgba(dark,0.05+R()*0.1) : rgba(light,0.04+R()*0.08);
    ctx.lineWidth = 0.5+R()*1.8;
    ctx.beginPath();
    const f1=0.004+R()*0.01, ph=R()*9;
    for(let x=0;x<=w;x+=8){ const y=y0+Math.sin(x*f1+ph)*amp+Math.sin(x*0.05+ph*2)*0.8; x?ctx.lineTo(x,y):ctx.moveTo(x,y); }
    ctx.stroke();
  }
}
const floorTex = canvasTex(1024,1024,(ctx,w,h)=>{
  const R=mulberry32(11), n=8, ph=h/n;
  for(let i=0;i<n;i++){
    ctx.save(); ctx.beginPath(); ctx.rect(0,i*ph,w,ph); ctx.clip();
    const b=[104+R()*30,70+R()*18,44+R()*12];
    ctx.fillStyle=rgba(b,1); ctx.fillRect(0,i*ph,w,ph);
    ctx.translate(0,i*ph); grain(ctx,w,ph,R,70,[40,24,12],[170,130,85],3); ctx.translate(0,-i*ph);
    ctx.fillStyle="rgba(18,10,5,.75)"; ctx.fillRect(0,i*ph,w,2.5);
    const off=R()*w; ctx.fillRect(off,i*ph,2.5,ph);
    ctx.restore();
  }
},{repeat:[4,3.5]});
const plasterTex = canvasTex(512,512,(ctx,w,h)=>{
  const R=mulberry32(5);
  ctx.fillStyle="#b4a68c"; ctx.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){
    const x=R()*w,y=R()*h,r=4+R()*40;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    const c = R()<0.5?[150,135,110]:[205,195,172];
    g.addColorStop(0,rgba(c,0.05)); g.addColorStop(1,rgba(c,0));
    ctx.fillStyle=g; ctx.fillRect(x-r,y-r,2*r,2*r);
  }
},{repeat:[3,1.5]});
const woodTex = canvasTex(256,512,(ctx,w,h)=>{
  const R=mulberry32(3);
  ctx.fillStyle="#6a4528"; ctx.fillRect(0,0,w,h);
  ctx.save(); ctx.translate(w,0); ctx.rotate(Math.PI/2); grain(ctx,h,w,R,90,[35,20,10],[150,105,65],4); ctx.restore();
});
const darkWoodTex = canvasTex(256,512,(ctx,w,h)=>{
  const R=mulberry32(9);
  ctx.fillStyle="#3b2617"; ctx.fillRect(0,0,w,h);
  ctx.save(); ctx.translate(w,0); ctx.rotate(Math.PI/2); grain(ctx,h,w,R,80,[15,8,4],[95,62,38],3); ctx.restore();
});
const linenTex = canvasTex(256,256,(ctx,w,h)=>{
  ctx.fillStyle="#b59d76"; ctx.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=3){ ctx.fillStyle="rgba(80,60,35,.12)"; ctx.fillRect(0,y,w,1); }
  for(let x=0;x<w;x+=3){ ctx.fillStyle="rgba(230,215,185,.08)"; ctx.fillRect(x,0,1,h); }
},{repeat:[2,2]});
const skyTex = canvasTex(1024,512,(ctx,w,h)=>{
  const g=ctx.createLinearGradient(0,0,0,h);
  g.addColorStop(0,"#8fb2d4"); g.addColorStop(0.55,"#cfdbe2"); g.addColorStop(0.75,"#f1e2c2"); g.addColorStop(1,"#e9cfa4");
  ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  const R=mulberry32(21);
  // 远山
  ctx.fillStyle="#9aa6a4"; ctx.beginPath(); ctx.moveTo(0,h*0.72);
  for(let x=0;x<=w;x+=20) ctx.lineTo(x,h*0.66+Math.sin(x*0.006)*18+Math.sin(x*0.021)*7);
  ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.fill();
  // 托斯卡纳屋顶
  for(let i=0;i<26;i++){
    const x=R()*w, bw=40+R()*90, top=h*(0.74+R()*0.12);
    ctx.fillStyle=["#c8b89a","#d6c6a4","#bfa47e"][i%3]; ctx.fillRect(x,top,bw,h-top);
    ctx.fillStyle=["#a4553a","#b5623f","#94492f"][i%3];
    ctx.beginPath(); ctx.moveTo(x-6,top); ctx.lineTo(x+bw/2,top-14-R()*10); ctx.lineTo(x+bw+6,top); ctx.fill();
  }
  // 穹顶与钟楼
  const dx=w*0.62, dy=h*0.7;
  ctx.fillStyle="#d8c7a6"; ctx.fillRect(dx-70,dy,140,h-dy);
  ctx.fillStyle="#b4593c"; ctx.beginPath(); ctx.ellipse(dx,dy,62,70,0,Math.PI,0); ctx.fill();
  ctx.strokeStyle="rgba(240,230,210,.6)"; ctx.lineWidth=2;
  for(let k=-2;k<=2;k++){ ctx.beginPath(); ctx.ellipse(dx,dy,Math.abs(k)*14,70,0,Math.PI,0); ctx.stroke(); }
  ctx.fillStyle="#e8dcc4"; ctx.fillRect(dx-6,dy-88,12,20);
  ctx.fillStyle="#cdb995"; ctx.fillRect(w*0.4,h*0.5,26,h*0.5);
  ctx.fillStyle="#a4553a"; ctx.beginPath(); ctx.moveTo(w*0.4-3,h*0.5); ctx.lineTo(w*0.4+13,h*0.45); ctx.lineTo(w*0.4+29,h*0.5); ctx.fill();
  // 柏树
  for(let i=0;i<9;i++){
    const x=R()*w, y=h*(0.8+R()*0.1), th=50+R()*50;
    ctx.fillStyle="#2f3d26"; ctx.beginPath(); ctx.ellipse(x,y-th/2,8+R()*4,th/2,0,0,Math.PI*2); ctx.fill();
  }
});
const rugTex = canvasTex(1024,700,(ctx,w,h)=>{
  const R=mulberry32(4);
  ctx.fillStyle="#6a1c1a"; ctx.fillRect(0,0,w,h);
  const band=(m,c,lw)=>{ ctx.strokeStyle=c; ctx.lineWidth=lw; ctx.strokeRect(m,m,w-2*m,h-2*m); };
  band(22,"#1f2a44",40); band(48,"#c49a45",5); band(70,"#1f2a44",14); band(84,"#c49a45",3);
  for(let x=60;x<w-40;x+=36){ ctx.fillStyle="#c49a45"; ctx.save(); ctx.translate(x,22); ctx.rotate(Math.PI/4); ctx.fillRect(-6,-6,12,12); ctx.restore(); ctx.save(); ctx.translate(x,h-22); ctx.rotate(Math.PI/4); ctx.fillRect(-6,-6,12,12); ctx.restore(); }
  for(let y=60;y<h-40;y+=36){ ctx.fillStyle="#c49a45"; ctx.save(); ctx.translate(22,y); ctx.rotate(Math.PI/4); ctx.fillRect(-6,-6,12,12); ctx.restore(); ctx.save(); ctx.translate(w-22,y); ctx.rotate(Math.PI/4); ctx.fillRect(-6,-6,12,12); ctx.restore(); }
  for(let y=120;y<h-100;y+=46) for(let x=120;x<w-100;x+=46){
    ctx.fillStyle = (x+y)%92 ? "rgba(196,154,69,.45)" : "rgba(31,42,68,.55)";
    ctx.beginPath(); ctx.moveTo(x,y-9); ctx.lineTo(x+9,y); ctx.lineTo(x,y+9); ctx.lineTo(x-9,y); ctx.fill();
  }
  const cx=w/2, cy=h/2;
  ctx.fillStyle="#1f2a44"; ctx.beginPath(); ctx.moveTo(cx,cy-190); ctx.lineTo(cx+300,cy); ctx.lineTo(cx,cy+190); ctx.lineTo(cx-300,cy); ctx.fill();
  ctx.strokeStyle="#c49a45"; ctx.lineWidth=6; ctx.stroke();
  ctx.fillStyle="#8e2a22"; ctx.beginPath(); ctx.ellipse(cx,cy,130,80,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#c49a45"; ctx.lineWidth=4; ctx.stroke();
  ctx.fillStyle="#c49a45"; ctx.beginPath(); ctx.ellipse(cx,cy,34,22,0,0,Math.PI*2); ctx.fill();
  const img=ctx.getImageData(0,0,w,h), d=img.data;            // 磨损与绒毛
  for(let i=0;i<d.length;i+=4){ const n=(R()-0.5)*26; d[i]+=n; d[i+1]+=n; d[i+2]+=n; }
  ctx.putImageData(img,0,0);
});

/* ---------- 材质 ---------- */
const M = {
  floor:   new THREE.MeshStandardMaterial({map:floorTex, roughness:0.62}),
  plaster: new THREE.MeshStandardMaterial({map:plasterTex, roughness:0.95}),
  ceiling: new THREE.MeshStandardMaterial({color:"#8e8270", roughness:1}),
  beam:    new THREE.MeshStandardMaterial({map:darkWoodTex, roughness:0.8}),
  wood:    new THREE.MeshStandardMaterial({map:woodTex, roughness:0.6}),
  darkWood:new THREE.MeshStandardMaterial({map:darkWoodTex, roughness:0.55}),
  linen:   new THREE.MeshStandardMaterial({map:linenTex, roughness:0.95}),
  gold:    new THREE.MeshStandardMaterial({color:"#b48d3e", metalness:0.9, roughness:0.38}),
  metal:   new THREE.MeshStandardMaterial({color:"#c8c8c4", metalness:1, roughness:0.28}),
  brass:   new THREE.MeshStandardMaterial({color:"#b08a3c", metalness:1, roughness:0.35}),
  plasterCast: new THREE.MeshStandardMaterial({color:"#ece6da", roughness:0.92}),
  windowFrame: new THREE.MeshStandardMaterial({color:"#5b6553", roughness:0.7}),
  glass:   new THREE.MeshPhysicalMaterial({color:"#dfe9ef", roughness:0.05, transparent:true, opacity:0.12, depthWrite:false}),
  rug:     new THREE.MeshStandardMaterial({map:rugTex, roughness:1}),
  black:   new THREE.MeshStandardMaterial({color:"#1a1714", roughness:0.5}),
};

function box(w,h,d,mat,x,y,z,parent,opt={}){
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); m.castShadow = opt.cast!==false; m.receiveShadow = true;
  if(opt.rx) m.rotation.x=opt.rx; if(opt.ry) m.rotation.y=opt.ry; if(opt.rz) m.rotation.z=opt.rz;
  (parent||scene).add(m); return m;
}
function cyl(rt,rb,h,mat,x,y,z,parent,seg=20){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat);
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true;
  (parent||scene).add(m); return m;
}
function smoothLathe(pts, segs=40, n=48){
  const curve = new THREE.SplineCurve(pts.map(p=>new THREE.Vector2(p[0],p[1])));
  return new THREE.LatheGeometry(curve.getPoints(n), segs);
}

/* ==================== 房间 ==================== */
const RX0=-4, RX1=4, RZ0=-3, RZ1=4, RH=3.4;
const WIN = {z0:0.0, z1:2.6, y0:0.8, y1:2.9};
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RX1-RX0, RZ1-RZ0), M.floor);
  floor.rotation.x = -Math.PI/2; floor.position.set((RX0+RX1)/2,0,(RZ0+RZ1)/2); floor.receiveShadow = true; scene.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RX1-RX0, RZ1-RZ0), M.ceiling);
  ceil.rotation.x = Math.PI/2; ceil.position.set((RX0+RX1)/2,RH,(RZ0+RZ1)/2); scene.add(ceil);
  for(let z=RZ0+0.7; z<RZ1; z+=1.3) box(RX1-RX0,0.18,0.16,M.beam,0,RH-0.09,z);
  const T=0.16, W=RX1-RX0, D=RZ1-RZ0;
  box(W,RH,T,M.plaster,0,RH/2,RZ0-T/2);              // 后墙
  box(W,RH,T,M.plaster,0,RH/2,RZ1+T/2);              // 前墙
  box(T,RH,D,M.plaster,RX1+T/2,RH/2,(RZ0+RZ1)/2);    // 右墙
  // 左墙：留出朝北的大窗
  const lx = RX0-T/2;
  box(T,RH,WIN.z0-RZ0,M.plaster,lx,RH/2,(RZ0+WIN.z0)/2);
  box(T,RH,RZ1-WIN.z1,M.plaster,lx,RH/2,(WIN.z1+RZ1)/2);
  box(T,WIN.y0,WIN.z1-WIN.z0,M.plaster,lx,WIN.y0/2,(WIN.z0+WIN.z1)/2);
  box(T,RH-WIN.y1,WIN.z1-WIN.z0,M.plaster,lx,(WIN.y1+RH)/2,(WIN.z0+WIN.z1)/2);
  // 墙裙与踢脚线
  const dado = (w,x,z,ry)=>{ box(w,0.9,0.02,M.darkWood,x,0.45,z,null,{ry}); box(w,0.05,0.05,M.darkWood,x,0.92,z,null,{ry}); };
  dado(W,0,RZ0+0.01,0); dado(D,RX1-0.01,(RZ0+RZ1)/2,Math.PI/2);
  // 窗框、窗格、窗台
  const wz=(WIN.z0+WIN.z1)/2, wy=(WIN.y0+WIN.y1)/2, ww=WIN.z1-WIN.z0, wh=WIN.y1-WIN.y0;
  box(0.1,0.06,ww,M.windowFrame,RX0,WIN.y1-0.03,wz); box(0.1,0.06,ww,M.windowFrame,RX0,WIN.y0+0.03,wz);
  box(0.1,wh,0.06,M.windowFrame,RX0,wy,WIN.z0+0.03); box(0.1,wh,0.06,M.windowFrame,RX0,wy,WIN.z1-0.03);
  for(let k=1;k<3;k++) box(0.06,wh,0.035,M.windowFrame,RX0,wy,WIN.z0+ww*k/3);
  for(let k=1;k<4;k++) box(0.06,0.035,ww,M.windowFrame,RX0,WIN.y0+wh*k/4,wz);
  box(0.3,0.05,ww+0.2,M.wood,RX0+0.08,WIN.y0-0.02,wz);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(ww,wh), M.glass);
  glass.rotation.y = Math.PI/2; glass.position.set(RX0,wy,wz); scene.add(glass);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(16,8), new THREE.MeshBasicMaterial({map:skyTex, toneMapped:false}));
  sky.rotation.y = Math.PI/2; sky.position.set(RX0-5,1.9,wz); scene.add(sky);
  // 地毯
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.8), M.rug);
  rug.rotation.x=-Math.PI/2; rug.position.set(-0.2,0.004,0.75); rug.receiveShadow=true; scene.add(rug);
}

/* ---------- 灯光 ---------- */
const hemi = new THREE.HemisphereLight("#e6ebf2","#5a4632",0.55); scene.add(hemi);
const windowLight = new THREE.RectAreaLight("#eef2fa", 7, WIN.z1-WIN.z0, WIN.y1-WIN.y0);
windowLight.position.set(RX0+0.02,(WIN.y0+WIN.y1)/2,(WIN.z0+WIN.z1)/2);
windowLight.lookAt(0,(WIN.y0+WIN.y1)/2-0.2,(WIN.z0+WIN.z1)/2);
scene.add(windowLight);
const sun = new THREE.DirectionalLight("#ffe0b0", 3.2);
sun.position.set(-9.5,5.6,4.6); sun.target.position.set(-0.6,0.4,0.3);
sun.castShadow = true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:1,far:25});
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight("#fff4e6", 0.5);       // 画家身后的柔和补光，照亮画布
fill.position.set(0.5,2.6,4); fill.target.position.set(0,1.3,0); scene.add(fill, fill.target);
const lampLight = new THREE.PointLight("#ffb46b", 0, 7, 1.6);
lampLight.castShadow = true; lampLight.shadow.mapSize.set(1024,1024); lampLight.shadow.bias=-0.002;

/* ==================== 画架与画布 ==================== */
const easel = new THREE.Group(); scene.add(easel);
{
  const W=M.wood;
  box(0.07,0.07,0.8,W,-0.38,0.035,-0.12,easel); box(0.07,0.07,0.8,W,0.38,0.035,-0.12,easel);
  box(0.84,0.07,0.07,W,0,0.07,-0.12,easel);
  box(0.05,1.9,0.05,W,-0.33,0.98,0.0,easel,{rz:-0.035}); box(0.05,1.9,0.05,W,0.33,0.98,0.0,easel,{rz:0.035});
  box(0.065,2.25,0.05,W,0,1.13,-0.03,easel);
  box(0.05,1.85,0.05,W,0,0.9,-0.48,easel,{rx:0.27});
  box(0.7,0.05,0.04,W,0,0.55,0.0,easel);
  box(0.88,0.035,0.1,W,0,1.03,0.06,easel); box(0.88,0.035,0.02,W,0,1.06,0.105,easel);
  box(0.14,0.05,0.08,W,0,1.705,0.04,easel);
  const knob = cyl(0.02,0.02,0.03,M.brass,0,1.705,-0.02,easel); knob.rotation.x=Math.PI/2;
  // 参考图夹板（右侧挑出的小臂）
}
const CANVAS_W=0.8, CANVAS_H=0.6, CANVAS_Y=1.0475+CANVAS_H/2, CANVAS_Z=0.05, CANVAS_T=0.025;

/* ---------- 画布表面：颜色 / 厚度 / 湿度 三张贴图 ---------- */
const CW=1024, CH=768, HS=0.5;               // 厚度与湿度用半分辨率
const colorCv = makeCanvas(CW,CH), heightCv = makeCanvas(CW*HS,CH*HS), roughCv = makeCanvas(CW*HS,CH*HS);
const Cc = colorCv.getContext("2d",{willReadFrequently:true});
const Hc = heightCv.getContext("2d");
const Rc = roughCv.getContext("2d",{willReadFrequently:true});
Hc.setTransform(HS,0,0,HS,0,0); Rc.setTransform(HS,0,0,HS,0,0);
const colorTex = new THREE.CanvasTexture(colorCv); colorTex.colorSpace = THREE.SRGBColorSpace; colorTex.anisotropy = maxAniso;
const heightTex = new THREE.CanvasTexture(heightCv);
const roughTex = new THREE.CanvasTexture(roughCv);
const paintMat = new THREE.MeshPhysicalMaterial({
  map:colorTex, bumpMap:heightTex, bumpScale:2.2, roughnessMap:roughTex, roughness:1,
  clearcoat:0, clearcoatRoughness:0.15,
});
const canvasMesh = new THREE.Mesh(new THREE.BoxGeometry(CANVAS_W,CANVAS_H,CANVAS_T),
  [M.linen,M.linen,M.linen,M.linen,paintMat,M.linen]);
canvasMesh.position.set(0,CANVAS_Y,CANVAS_Z); canvasMesh.castShadow = canvasMesh.receiveShadow = true;
easel.add(canvasMesh);
let canvasDirty = true;

function makeFrame(w,h,prof=0.06){
  const s = new THREE.Shape();
  s.moveTo(-w/2-prof,-h/2-prof); s.lineTo(w/2+prof,-h/2-prof); s.lineTo(w/2+prof,h/2+prof); s.lineTo(-w/2-prof,h/2+prof); s.lineTo(-w/2-prof,-h/2-prof);
  const hole = new THREE.Path();
  const e = 0.012;                       // 倒角会把内框往里收 0.02，留出余量，只压住画布边缘 8mm
  hole.moveTo(-w/2-e,-h/2-e); hole.lineTo(-w/2-e,h/2+e); hole.lineTo(w/2+e,h/2+e); hole.lineTo(w/2+e,-h/2-e); hole.lineTo(-w/2-e,-h/2-e);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s,{depth:0.03, bevelEnabled:true, bevelThickness:0.018, bevelSize:0.02, bevelSegments:4, curveSegments:4});
  const m = new THREE.Mesh(g, M.gold); m.castShadow = true; m.receiveShadow = true;
  return m;
}
const easelFrame = makeFrame(CANVAS_W,CANVAS_H);
easelFrame.position.set(0,CANVAS_Y,CANVAS_Z-0.01); easelFrame.visible = false; easel.add(easelFrame);

// 参考图夹板
const refBoard = new THREE.Group(); refBoard.visible = false; easel.add(refBoard);
const refMat = new THREE.MeshStandardMaterial({color:"#ffffff", roughness:0.8});
{
  box(0.36,0.02,0.02,M.wood,0.52,1.62,0.03,refBoard);
  const b = box(0.32,0.25,0.008,M.darkWood,0.66,1.5,0.045,refBoard);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.29,0.22), refMat); p.position.set(0.66,1.5,0.05); refBoard.add(p); refBoard.userData.photo = p;
  box(0.05,0.02,0.015,M.metal,0.66,1.615,0.055,refBoard);
}

/* ==================== 静物台 ==================== */
const still = new THREE.Group(); still.position.set(-1.0,0,-0.05); still.rotation.y = 0.35; scene.add(still);
{
  const top=0.98, hx=0.31, hz=0.24;
  box(hx*2-0.02,top-0.01,hz*2-0.02,M.darkWood,0,(top-0.01)/2,0,still);
  // 垂坠的桌布：落在台面外的顶点向下垂，并沿边缘起褶
  const cg = new THREE.PlaneGeometry(1.25,1.05,90,76); cg.rotateX(-Math.PI/2);
  const P = cg.attributes.position;
  for(let i=0;i<P.count;i++){
    const x=P.getX(i), z=P.getZ(i);
    const dx=Math.max(0,Math.abs(x)-hx), dz=Math.max(0,Math.abs(z)-hz);
    let nx=x, nz=z, y=top+0.003+Math.sin(x*40)*Math.sin(z*33)*0.0015;
    if(dx>0||dz>0){
      const d=Math.hypot(dx,dz);
      y = top - d*0.98;
      const fold = Math.min(1,d*5);
      if(dx>0){ nx = Math.sign(x)*(hx+0.006+0.022*fold*(0.5+0.5*Math.sin(z*26+1.3))); }
      if(dz>0){ nz = Math.sign(z)*(hz+0.006+0.022*fold*(0.5+0.5*Math.sin(x*24))); }
    }
    P.setXYZ(i,nx,Math.max(y,0.01),nz);
  }
  cg.computeVertexNormals();
  const cloth = new THREE.Mesh(cg, new THREE.MeshPhysicalMaterial({color:"#7a2420", roughness:0.85, sheen:1, sheenColor:new THREE.Color("#d9776a"), sheenRoughness:0.5, side:THREE.DoubleSide}));
  cloth.castShadow = cloth.receiveShadow = true; still.add(cloth);
  const put = (geo,mat,x,z,ry=0,sc=1)=>{ const m=new THREE.Mesh(geo,mat); m.position.set(x,top,z); m.rotation.y=ry; m.scale.setScalar(sc); m.castShadow=m.receiveShadow=true; still.add(m); return m; };
  // 陶罐
  const jug = put(smoothLathe([[0.001,0],[0.05,0.002],[0.07,0.03],[0.078,0.08],[0.068,0.13],[0.045,0.175],[0.036,0.205],[0.042,0.235],[0.038,0.236],[0.03,0.21]]),
    new THREE.MeshPhysicalMaterial({color:"#9a4e2a", roughness:0.38, clearcoat:0.7, clearcoatRoughness:0.25, side:THREE.DoubleSide}), -0.12,-0.1);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045,0.009,10,24,Math.PI*1.1), jug.material);
  handle.position.set(0.07,0.15,0); handle.rotation.z = -Math.PI/2; handle.castShadow=true; jug.add(handle);
  // 酒瓶
  put(smoothLathe([[0.001,0],[0.036,0.002],[0.038,0.02],[0.038,0.17],[0.03,0.21],[0.013,0.25],[0.012,0.31],[0.015,0.315],[0.001,0.316]]),
    new THREE.MeshPhysicalMaterial({color:"#183a22", roughness:0.06, clearcoat:1, metalness:0.1}), 0.13,-0.12);
  // 苹果
  const appleTex = canvasTex(128,128,(ctx,w,h)=>{
    const g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,"#b49a3c"); g.addColorStop(0.2,"#a32a1c"); g.addColorStop(0.8,"#8e1a16"); g.addColorStop(1,"#c3a046");
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    const R=mulberry32(8); for(let i=0;i<70;i++){ ctx.strokeStyle=rgba(R()<0.5?[200,120,50]:[110,15,15],0.25); ctx.lineWidth=1+R()*2; const x=R()*w; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+(R()-0.5)*6,h); ctx.stroke(); }
  });
  const appleGeo = smoothLathe([[0.001,0.008],[0.014,0.002],[0.032,0.008],[0.043,0.028],[0.045,0.048],[0.039,0.07],[0.024,0.081],[0.009,0.076],[0.001,0.07]]);
  const appleMat = new THREE.MeshPhysicalMaterial({map:appleTex, roughness:0.42, clearcoat:0.5});
  const stemMat = new THREE.MeshStandardMaterial({color:"#4a3218"});
  [[0.02,0.1,0.4],[0.11,0.06,2.1]].forEach(([x,z,r])=>{ const a=put(appleGeo,appleMat,x,z,r); const s=cyl(0.002,0.0025,0.022,stemMat,0,0.082,0,a); s.rotation.z=0.3; });
  // 梨
  put(smoothLathe([[0.001,0],[0.022,0.004],[0.036,0.025],[0.037,0.045],[0.026,0.07],[0.018,0.095],[0.014,0.115],[0.006,0.125],[0.001,0.124]]),
    new THREE.MeshPhysicalMaterial({color:"#b7a43c", roughness:0.5, clearcoat:0.3}), -0.04,0.13, 0.3);
  // 柠檬
  const lemon = new THREE.Mesh(new THREE.SphereGeometry(0.03,24,16), new THREE.MeshPhysicalMaterial({color:"#e3bd22", roughness:0.55, clearcoat:0.3}));
  lemon.scale.set(1.35,0.9,0.95); lemon.position.set(-0.17,top+0.027,0.1); lemon.rotation.y=0.6; lemon.castShadow=lemon.receiveShadow=true; still.add(lemon);
  // 铜碗
  put(smoothLathe([[0.001,0],[0.04,0.002],[0.07,0.02],[0.085,0.045],[0.083,0.047],[0.066,0.024],[0.038,0.01],[0.001,0.009]]),
    M.brass, -0.2,-0.02, 0, 0.85);
}

/* ==================== 调色台（矮柜）与工具 ==================== */
const taboret = new THREE.Group(); taboret.position.set(0.98,0,0.42); taboret.rotation.y = -0.45; scene.add(taboret);
const TAB_TOP = 0.78;
{
  box(0.9,0.04,0.56,M.wood,0,TAB_TOP-0.02,0,taboret);
  [[-0.42,-0.25],[0.42,-0.25],[-0.42,0.25],[0.42,0.25]].forEach(([x,z])=>box(0.04,TAB_TOP-0.04,0.04,M.wood,x,(TAB_TOP-0.04)/2,z,taboret));
  box(0.86,0.025,0.5,M.wood,0,0.22,0,taboret);
  // 下层：一摞画册与布
  box(0.3,0.05,0.22,new THREE.MeshStandardMaterial({color:"#5d2b22",roughness:0.8}),-0.2,0.258,0,taboret);
  box(0.28,0.04,0.2,new THREE.MeshStandardMaterial({color:"#2c3a4e",roughness:0.8}),-0.19,0.303,0.01,taboret,{ry:0.1});
}
const interactive = [];           // 可点击的 3D 物体
function tag(obj, kind, data){ obj.traverse(o=>{ if(o.isMesh){ o.userData.kind=kind; o.userData.data=data; } }); interactive.push(obj); }

/* ---------- 调色板 ---------- */
const PAL_W=0.46, PAL_H=0.34, PAL_TOP=0.0102;
const PW=512, PH=Math.round(512*PAL_H/PAL_W);
const palette = new THREE.Group(); scene.add(palette);
const palShape = new THREE.Shape(); palShape.absellipse(0,0,PAL_W/2,PAL_H/2,0,Math.PI*2,false,0);
const thumb = new THREE.Path(); thumb.absellipse(-0.145,-0.065,0.021,0.028,0,Math.PI*2,true,0.4); palShape.holes.push(thumb);
{
  const g = new THREE.ExtrudeGeometry(palShape,{depth:0.008,bevelEnabled:true,bevelThickness:0.0022,bevelSize:0.003,bevelSegments:2,curveSegments:48});
  g.rotateX(-Math.PI/2);
  const body = new THREE.Mesh(g, new THREE.MeshStandardMaterial({color:"#a77a45", roughness:0.55})); body.castShadow=body.receiveShadow=true; palette.add(body);
}
// 调色板表面 = 木纹底 + 颜料层（颜料层是可读写的像素数组）
const palWood = makeCanvas(PW,PH), palDisp = makeCanvas(PW,PH), palLayerCv = makeCanvas(PW,PH);
{
  const ctx = palWood.getContext("2d"), R=mulberry32(31);
  ctx.fillStyle="#b88d58"; ctx.fillRect(0,0,PW,PH); grain(ctx,PW,PH,R,110,[110,70,35],[225,190,140],3);
  for(let i=0;i<40;i++){ ctx.fillStyle=rgba(PIGMENTS[(R()*12)|0].rgb,0.12); ctx.beginPath(); ctx.ellipse(R()*PW,R()*PH,4+R()*14,3+R()*8,R()*3,0,Math.PI*2); ctx.fill(); }  // 陈年干颜料痕
}
const palDispCtx = palDisp.getContext("2d"), palLayerCtx = palLayerCv.getContext("2d");
const palImg = palLayerCtx.createImageData(PW,PH), PD = palImg.data;
const palTex = new THREE.CanvasTexture(palDisp); palTex.colorSpace = THREE.SRGBColorSpace; palTex.anisotropy = maxAniso;
const palTopMat = new THREE.MeshPhysicalMaterial({map:palTex, roughness:0.42, clearcoat:0.35, clearcoatRoughness:0.3});
let palDirty = true;
{
  const g = new THREE.ShapeGeometry(palShape, 48);
  const uv = g.attributes.uv;
  for(let i=0;i<uv.count;i++) uv.setXY(i,(uv.getX(i)+PAL_W/2)/PAL_W,(uv.getY(i)+PAL_H/2)/PAL_H);
  g.rotateX(-Math.PI/2); g.translate(0,PAL_TOP,0);
  const top = new THREE.Mesh(g, palTopMat); top.receiveShadow = true; palette.add(top);
  tag(top,"palette");
}
function redrawPalette(){
  palLayerCtx.putImageData(palImg,0,0);
  palDispCtx.drawImage(palWood,0,0); palDispCtx.drawImage(palLayerCv,0,0);
  palTex.needsUpdate = true;
}
// 调色板边缘的颜料坨：每种颜料固定一个位置（从浅到深）
const blobs = [];
function blobSlot(i){
  const a = Math.PI*(0.86 - i*0.72/(PIGMENTS.length-1));
  return [Math.cos(a)*PAL_W/2*0.8, Math.sin(a)*PAL_H/2*0.8];
}
function makeBlobGeo(seed){
  const R = mulberry32(seed), g = new THREE.SphereGeometry(1,22,16), P=g.attributes.position;
  const tw = R()*6;
  for(let i=0;i<P.count;i++){
    let x=P.getX(i), y=P.getY(i), z=P.getZ(i);
    const n = 1 + 0.08*Math.sin(x*5+tw) + 0.06*Math.sin(z*7+tw*2);
    x*=n; z*=n; y = y<0 ? y*0.15 : y*(0.55+0.1*Math.sin(x*4+tw));
    if(y>0.35){ const k=(y-0.35); x+=k*0.7; y+=k*0.6; }       // 挤出时卷起的小尖
    P.setXYZ(i,x,y,z);
  }
  g.computeVertexNormals(); return g;
}
function squeeze(pi, silent){
  const pg = PIGMENTS[pi];
  let b = blobs[pi];
  if(!b){
    const mesh = new THREE.Mesh(makeBlobGeo(pi*7+3), new THREE.MeshPhysicalMaterial({color:pg.hex, roughness:0.3, clearcoat:0.6, clearcoatRoughness:0.2}));
    mesh.castShadow = true;
    const [sx,sy] = blobSlot(pi); mesh.position.set(sx,PAL_TOP,-sy); mesh.rotation.y = Math.random()*6;
    mesh.scale.setScalar(0.0001); palette.add(mesh); tag(mesh,"blob",pi);
    b = blobs[pi] = {mesh, amount:0, shown:0};
  }
  b.amount = Math.min(1.25, b.amount+1);
  const tube = tubes[pi]; if(tube) tube.userData.squeezeT = 1;
  if(!silent) toast(`挤出 <b>${pg.name}</b> ${pg.en}`);
}
function blobScale(b){ return b.amount<=0 ? 0.0001 : 0.017*(0.45+0.55*Math.min(1,b.amount)); }

/* ---------- 颜料管 ---------- */
const tubes = [];
{
  const body = smoothLathe([[0.006,0],[0.0125,0.01],[0.0137,0.03],[0.0137,0.072],[0.0128,0.088],[0.006,0.097],[0.0052,0.1]],32,32);
  const capGeo = new THREE.CylinderGeometry(0.0078,0.0078,0.018,16);
  const crimpGeo = new THREE.BoxGeometry(0.027,0.008,0.003);
  PIGMENTS.forEach((pg,i)=>{
    const tex = canvasTex(256,128,(ctx,w,h)=>{
      const g=ctx.createLinearGradient(0,0,w,0); g.addColorStop(0,"#bfbfbd"); g.addColorStop(0.5,"#f2f2ee"); g.addColorStop(1,"#9e9e9a");
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle=pg.hex; ctx.fillRect(0,22,w,74);
      ctx.fillStyle="#f6f1e4"; ctx.fillRect(0,40,w*0.62,36);
      ctx.fillStyle="#2a2018"; ctx.font="bold 15px Georgia"; ctx.fillText(pg.en,8,57); ctx.font="13px serif"; ctx.fillText(pg.name+" · Atelier",8,73);
    });
    const grp = new THREE.Group();
    const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({map:tex, metalness:0.45, roughness:0.38})); m.castShadow=true; grp.add(m);
    const cap = new THREE.Mesh(capGeo, M.black); cap.position.y=0.107; grp.add(cap);
    const crimp = new THREE.Mesh(crimpGeo, m.material); crimp.position.y=-0.003; grp.add(crimp);
    grp.rotation.z = Math.PI/2; grp.rotation.y = (Math.random()-0.5)*0.08;
    grp.position.set(0.39, TAB_TOP+0.0137, -0.2+i*0.034);
    grp.userData.base = grp.position.clone();
    taboret.add(grp); tag(grp,"tube",i); tubes.push(grp);
  });
}

/* ---------- 画笔、调色刀、笔筒、松节油、抹布 ---------- */
function makeTool(type){
  const g = new THREE.Group();
  const handleMat = new THREE.MeshStandardMaterial({color:{round:"#7a1f1a",flat:"#1d1d1d",filbert:"#2b4a3a",fan:"#6b4a2a",soft:"#a37b4a",knife:"#4a2f1c"}[type], roughness:0.35});
  const tuftMat = new THREE.MeshStandardMaterial({color:rgbHex(BRISTLE_RGB), roughness:0.75});
  if(type==="knife"){
    cyl(0.0045,0.006,0.11,handleMat,0,0.055,0,g,12);
    cyl(0.005,0.005,0.012,M.metal,0,0.116,0,g,12);
    const shank = cyl(0.0016,0.0016,0.05,M.metal,0,0.135,0.006,g,8); shank.rotation.x = 0.5;
    const s = new THREE.Shape(); s.moveTo(0,0); s.lineTo(0.013,0.022); s.lineTo(0,0.075); s.lineTo(-0.013,0.022); s.lineTo(0,0);
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:0.0006,bevelEnabled:false}), new THREE.MeshStandardMaterial({color:"#d8d8d4",metalness:1,roughness:0.18}));
    blade.position.set(0,0.152,0.018); blade.castShadow=true; g.add(blade);
    const smear = new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:0.0004,bevelEnabled:false}), tuftMat);
    smear.scale.set(0.85,0.7,1); smear.position.set(0,0.162,0.0188); g.add(smear);
    g.userData = {type, tuftMat, tip:0.227, tipMesh:smear};
    return g;
  }
  cyl(0.0058,0.0032,0.2,handleMat,0,0.1,0,g,12);
  const fer = cyl(0.0058,0.0058,0.03,M.metal,0,0.215,0,g,14);
  let tuft;
  if(type==="flat"){ fer.scale.set(1.5,1,0.6); tuft = new THREE.Mesh(new THREE.BoxGeometry(0.016,0.026,0.0045), tuftMat); tuft.position.y=0.243; }
  else if(type==="fan"){
    const s=new THREE.Shape(); s.moveTo(0,0); s.absarc(0,0,0.034,Math.PI*0.3,Math.PI*0.7,false); s.lineTo(0,0);
    tuft = new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:0.0015,bevelEnabled:false}), tuftMat); tuft.position.set(0,0.222,-0.0008);
  }
  else{
    const prof = type==="soft" ? [[0.0062,0],[0.0095,0.012],[0.008,0.026],[0.001,0.038]]
               : type==="filbert" ? [[0.0058,0],[0.0068,0.012],[0.005,0.022],[0.001,0.027]]
               : [[0.0058,0],[0.0062,0.008],[0.0035,0.022],[0.0004,0.032]];
    tuft = new THREE.Mesh(smoothLathe(prof,16,16), tuftMat); tuft.position.y=0.23;
    if(type==="filbert") tuft.scale.set(1.5,1,0.6);
  }
  tuft.castShadow = true; g.add(tuft);
  g.traverse(o=>{ if(o.isMesh) o.castShadow = true; });
  g.userData = {type, tuftMat, tip: type==="soft"?0.268:type==="fan"?0.256:0.262, tipMesh:tuft};
  return g;
}
const jarTools = {};
{
  const jar = new THREE.Group(); jar.position.set(0.15,TAB_TOP,-0.17); taboret.add(jar);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.048,0.044,0.14,28,1,true), new THREE.MeshPhysicalMaterial({color:"#cfdcd8",roughness:0.05,transparent:true,opacity:0.28,side:THREE.DoubleSide,depthWrite:false}));
  glass.position.y=0.07; jar.add(glass);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.044,28), glass.material); bottom.rotation.x=-Math.PI/2; bottom.position.y=0.002; jar.add(bottom);
  ["round","flat","filbert","fan","soft"].forEach((t,i)=>{
    const b = makeTool(t); const a = i/5*Math.PI*2;
    b.position.set(Math.cos(a)*0.018,0.005,Math.sin(a)*0.018);
    b.rotation.set(Math.sin(a)*0.16, 0, -Math.cos(a)*0.16);
    jar.add(b); tag(b,"jarTool",t); jarTools[t]=b;
  });
  // 调色刀平放在台面前沿：刀柄朝左，刀片朝右、贴着桌面
  const k = makeTool("knife");
  k.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,-1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,-1,0)));
  k.position.set(-0.34,TAB_TOP+0.0195,0.235); taboret.add(k); tag(k,"jarTool","knife"); jarTools.knife=k;
  // 松节油罐：点它洗笔
  const turps = new THREE.Group(); turps.position.set(0.16,TAB_TOP,0.02); taboret.add(turps);
  const tg = new THREE.Mesh(new THREE.CylinderGeometry(0.036,0.036,0.09,24,1,true), glass.material); tg.position.y=0.045; turps.add(tg);
  const liquidMat = new THREE.MeshPhysicalMaterial({color:"#c9a35a",roughness:0.05,transparent:true,opacity:0.55});
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.033,0.033,0.06,24), liquidMat); liquid.position.y=0.031; turps.add(liquid);
  turps.userData.liquidMat = liquidMat;
  tag(turps,"turps"); palette.userData.turps = turps;
  // 油壶
  cyl(0.018,0.016,0.03,M.brass,0.08,TAB_TOP+0.015,-0.07,taboret);
  // 抹布：点它擦调色刀
  const rg = new THREE.PlaneGeometry(0.2,0.16,24,20); rg.rotateX(-Math.PI/2);
  const RP = rg.attributes.position, RR=mulberry32(77);
  for(let i=0;i<RP.count;i++){ const x=RP.getX(i), z=RP.getZ(i); RP.setY(i, 0.012+0.01*Math.sin(x*60+RR())*Math.cos(z*50)+0.008*Math.sin(x*23+z*31)); }
  rg.computeVertexNormals();
  const ragTex = canvasTex(128,128,(ctx,w,h)=>{ ctx.fillStyle="#d8d2c4"; ctx.fillRect(0,0,w,h); const R=mulberry32(12); for(let i=0;i<14;i++){ ctx.fillStyle=rgba(PIGMENTS[(R()*12)|0].rgb,0.45); ctx.beginPath(); ctx.ellipse(R()*w,R()*h,4+R()*16,2+R()*6,R()*3,0,7); ctx.fill(); } });
  const rag = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({map:ragTex, roughness:1, side:THREE.DoubleSide}));
  rag.position.set(0.14,TAB_TOP,0.17); rag.rotation.y=0.3; rag.castShadow=rag.receiveShadow=true; taboret.add(rag); tag(rag,"rag");
}
// 跟随鼠标的那支笔
const cursorTools = {};
Object.keys(TOOLS).forEach(t=>{ const g = makeTool(t); g.visible=false; scene.add(g); cursorTools[t]=g; });

/* ==================== 其他陈设 ==================== */
{
  // 画凳
  const stool = new THREE.Group(); stool.position.set(0.05,0,1.25); scene.add(stool);
  cyl(0.17,0.17,0.04,M.wood,0,0.62,0,stool,28);
  for(let k=0;k<3;k++){ const a=k*Math.PI*2/3; const l=box(0.035,0.64,0.035,M.wood,Math.cos(a)*0.11,0.31,Math.sin(a)*0.11,stool); l.rotation.set(Math.sin(a)*0.12,0,-Math.cos(a)*0.12); }
  // 靠墙的旧画布
  [[3.75,-2.4,0.0],[3.7,-2.0,0.06],[3.62,-1.6,0.12]].forEach(([x,z,r],i)=>{
    const s=[[0.7,0.9],[0.55,0.7],[0.9,0.65]][i];
    box(0.025,s[1],s[0],M.linen,x,s[1]/2,z,null,{rz:-0.12-r});
  });
  // 石膏几何体与书
  const cab = new THREE.Group(); cab.position.set(-3.35,0,-2.45); scene.add(cab);
  box(0.9,0.9,0.45,M.darkWood,0,0.45,0,cab);
  const pc = M.plasterCast;
  const sph = new THREE.Mesh(new THREE.SphereGeometry(0.09,32,24),pc); sph.position.set(-0.25,0.99,0); sph.castShadow=sph.receiveShadow=true; cab.add(sph);
  box(0.15,0.15,0.15,pc,0.02,0.975,0.02,cab,{ry:0.5});
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.075,0.24,32),pc); cone.position.set(0.25,1.02,-0.05); cone.castShadow=cone.receiveShadow=true; cab.add(cone);
  [["#6d2a20",0.05],["#2d3f2e",0.04],["#7a5a2a",0.06]].forEach(([c,t],i)=>box(0.26,t,0.19,new THREE.MeshStandardMaterial({color:c,roughness:0.8}),0.05,0.9+0.02+i*0.055+t/2,0.12,cab,{ry:0.1*i}));
  // 落地灯（夜间模式点亮）
  const lamp = new THREE.Group(); lamp.position.set(1.55,0,1.05); scene.add(lamp);
  cyl(0.14,0.16,0.03,M.black,0,0.015,0,lamp,24); cyl(0.012,0.012,1.75,M.brass,0,0.89,0,lamp,10);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.19,0.2,28,1,true), new THREE.MeshStandardMaterial({color:"#e8d5b0",roughness:0.9,side:THREE.DoubleSide,emissive:"#ffb46b",emissiveIntensity:0}));
  shade.position.y = 1.8; lamp.add(shade); lamp.userData.shade = shade;
  lampLight.position.set(0,1.74,0); lamp.add(lampLight);
  scene.userData.lamp = lamp;
}

/* ==================== 画廊墙：挂上的作品 ==================== */
const SLOTS = [
  {p:[-2.45,1.75,RZ0+0.04], ry:0},
  {p:[ 2.35,1.75,RZ0+0.04], ry:0},
  {p:[RX1-0.04,1.75,-1.6], ry:-Math.PI/2},
  {p:[RX1-0.04,1.75, 0.5], ry:-Math.PI/2},
  {p:[RX1-0.04,1.75, 2.6], ry:-Math.PI/2},
  {p:[-1.1,2.55,RZ0+0.04], ry:0, s:0.6},
];
const emptyTex = canvasTex(256,192,(ctx,w,h)=>{
  ctx.fillStyle="#3a3027"; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle="rgba(201,162,39,.35)"; ctx.setLineDash([6,5]); ctx.strokeRect(14,14,w-28,h-28);
  ctx.fillStyle="rgba(232,201,106,.7)"; ctx.font="20px serif"; ctx.textAlign="center"; ctx.fillText("虚位以待",w/2,h/2-4);
  ctx.font="italic 13px Georgia"; ctx.fillText("your masterpiece",w/2,h/2+20);
});
const gallery = SLOTS.map((s,i)=>{
  const g = new THREE.Group(); g.position.set(...s.p); g.rotation.y = s.ry; g.scale.setScalar((s.s||1)*1.1); scene.add(g);
  const fr = makeFrame(CANVAS_W,CANVAS_H); fr.position.z = -0.02; g.add(fr);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(CANVAS_W,CANVAS_H), new THREE.MeshStandardMaterial({map:emptyTex, roughness:0.6}));
  pic.position.z = 0.012; pic.receiveShadow = true; g.add(pic);
  tag(g,"slot",i);
  return {g, pic, item:null};
});
let galleryItems = [];
try{ galleryItems = JSON.parse(localStorage.getItem("atelier3d.gallery")||"[]"); }catch{ galleryItems = []; }
function refreshGallery(){
  gallery.forEach((s,i)=>{
    const it = galleryItems[i];
    if(it === s.item) return;
    s.item = it;
    if(!it){ s.pic.material.map = emptyTex; s.pic.material.roughness=0.6; s.pic.material.needsUpdate = true; return; }
    const img = new Image();
    img.onload = ()=>{ const t=new THREE.Texture(img); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=maxAniso; t.needsUpdate=true; s.pic.material.map=t; s.pic.material.roughness=0.35; s.pic.material.needsUpdate=true; };
    img.src = it.img;
  });
}
refreshGallery();

/* ==================== 画布绘画引擎 ==================== */
const brush = { tool:"round", size:16, thin:0.25 };
const loads = {}; Object.keys(TOOLS).forEach(t=>loads[t]={rgb:BRISTLE_RGB.slice(), amount:0});
const state = { stage:0, primed:false, varnished:false, framed:false, done:new Set(), signName:"" };

function linenGround(){
  const R = mulberry32(99);
  Cc.globalCompositeOperation="source-over"; Cc.globalAlpha=1; Cc.filter="none";
  Cc.fillStyle="#b39b73"; Cc.fillRect(0,0,CW,CH);
  for(let y=0;y<CH;y+=3){ Cc.fillStyle=`rgba(90,68,40,${0.08+R()*0.06})`; Cc.fillRect(0,y,CW,1); }
  for(let x=0;x<CW;x+=3){ Cc.fillStyle=`rgba(225,208,175,${0.05+R()*0.05})`; Cc.fillRect(x,0,1,CH); }
  for(let i=0;i<260;i++){ Cc.fillStyle=`rgba(${R()<0.5?"80,60,35":"220,200,165"},.25)`; Cc.fillRect(R()*CW,R()*CH,8+R()*40,1.5); }
  Hc.globalCompositeOperation="source-over"; Hc.globalAlpha=1;
  Hc.fillStyle="rgb(60,60,60)"; Hc.fillRect(0,0,CW,CH);
  for(let y=0;y<CH;y+=4){ Hc.fillStyle="rgba(150,150,150,.5)"; Hc.fillRect(0,y,CW,2); }
  for(let x=0;x<CW;x+=4){ Hc.fillStyle="rgba(130,130,130,.35)"; Hc.fillRect(x,0,2,CH); }
  Rc.globalCompositeOperation="source-over"; Rc.globalAlpha=1;
  Rc.fillStyle="rgb(245,245,245)"; Rc.fillRect(0,0,CW,CH);
  paintMat.clearcoat = 0; canvasDirty = true;
}

/* 一笔的状态：每根笔毛独立位置；笔毛分几组共享颜色抖动和粗细 */
function newStroke(tool, x, y, load, opts={}){
  const size = opts.size ?? brush.size, thin = opts.thin ?? brush.thin;
  const n = tool==="fan" ? 16 : tool==="flat" ? Math.round(14+size*0.6) : Math.round(10+size*0.55);
  const bw = Math.max(0.8, size*(tool==="fan"?0.9:1.7)/n*2);          // 笔毛粗细：相邻笔毛略有重叠
  const classes = [0,1,2,3].map(k=>({ j:[(Math.random()-0.5)*18,(Math.random()-0.5)*15,(Math.random()-0.5)*12], w:bw*(0.6+Math.random()*0.8), load:0.6+Math.random()*0.4 }));
  const bristles = [];
  for(let i=0;i<n;i++){
    let u, v;
    if(tool==="flat"){ u=(i/(n-1))*2-1; v=(Math.random()-0.5)*0.12; }
    else if(tool==="fan"){ u=(i/(n-1))*2-1; v=-Math.abs(u)*0.25+(Math.random()-0.5)*0.1; }
    else{ const a=Math.random()*Math.PI*2, r=Math.sqrt(Math.random()); u=Math.cos(a)*r; v=Math.sin(a)*r*(tool==="filbert"?0.55:1); }
    bristles.push({u, v, c:(Math.random()*4)|0, px:null, py:null});
  }
  return { tool, x, y, ang:null, size, thin, load, bristles, classes, auto:!!opts.auto, n:0 };
}
// 湿度贴图即粗糙度贴图：湿颜料≈55（发亮），干透≈212（哑光），上光油≈125 + 清漆层
const WET = v=>clamp((118-v)/55,0,1);
function wetAt(x,y){
  const px = clamp((x*HS)|0,0,roughCv.width-1), py = clamp((y*HS)|0,0,roughCv.height-1);
  return WET(Rc.getImageData(px,py,1,1).data[0]);
}
function sampleAvg(x,y,r){
  r = Math.max(1,Math.min(6,r|0));
  const x0=clamp((x-r)|0,0,CW-1), y0=clamp((y-r)|0,0,CH-1), x1=clamp((x+r)|0,0,CW-1), y1=clamp((y+r)|0,0,CH-1);
  const w=x1-x0+1, h=y1-y0+1, d=Cc.getImageData(x0,y0,w,h).data;
  let s0=0,s1=0,s2=0,n=0; for(let i=0;i<d.length;i+=4){ s0+=d[i]; s1+=d[i+1]; s2+=d[i+2]; n++; }
  return [s0/n|0,s1/n|0,s2/n|0];
}
function strokeTo(st, x, y){
  const dx=x-st.x, dy=y-st.y, dist=Math.hypot(dx,dy);
  if(dist<0.6) return;
  const a = Math.atan2(dy,dx);
  if(st.ang===null) st.ang=a;
  else{ let d=a-st.ang; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; st.ang+=d*0.35; }
  const stepLen = Math.max(1.2, st.size*0.16), n = Math.ceil(dist/stepLen);
  for(let i=1;i<=n;i++) stamp(st, st.x+dx*i/n, st.y+dy*i/n, dist/n);
  st.x=x; st.y=y; canvasDirty = true;
}
function stamp(st, px, py, seg){
  const L = st.load, tool = st.tool;
  st.n++;
  if(tool==="soft"){ smearAt(px,py,st.size*0.6,0.45,st.ang); return; }
  // 湿画法：笔会带起画布上未干的颜料，与笔上的颜色混合
  if(!st.auto && st.n%2===0){
    const wet = wetAt(px,py);
    if(wet>0.05){
      const under = sampleAvg(px,py,st.size*0.25);
      // 饱蘸的笔只沾一点底色；快没颜料的笔才会被底下的湿颜料"带走"
      const k = L.amount>0.25 ? 0.018 : L.amount>0.05 ? 0.05 : 0.12;
      L.rgb = mixPaint(L.rgb, under, (tool==="knife"?0.5:1)*k*wet);
      if(L.amount<0.2) L.amount += 0.003*wet;
    }
  }
  const load = st.auto ? 1 : clamp(L.amount*1.8,0,1);
  if(load<=0.02){ smearAt(px,py,st.size*0.45,0.25,st.ang); return; }
  const opacity = (0.95 - 0.82*st.thin) * load;
  const ca=Math.cos(st.ang||0), sa=Math.sin(st.ang||0), half=st.size/2;
  const hp = Math.max(0, 1-st.thin*1.15);                  // 越稠越有厚度
  if(tool==="knife"){
    const ox=-sa*half*1.15, oy=ca*half*1.15;
    const lx = st.kx ?? px, ly = st.ky ?? py;
    const quad=(ctx)=>{ ctx.beginPath(); ctx.moveTo(lx+ox,ly+oy); ctx.lineTo(px+ox,py+oy); ctx.lineTo(px-ox,py-oy); ctx.lineTo(lx-ox,ly-oy); ctx.closePath(); };
    Cc.globalCompositeOperation="source-over";
    Cc.fillStyle = rgba(L.rgb, Math.min(1,opacity*1.05)); quad(Cc); Cc.fill();
    Cc.strokeStyle = rgba(mixPaint(L.rgb,[250,248,240],0.15),0.35*load); Cc.lineWidth=1.2;
    Cc.beginPath(); Cc.moveTo(lx+ox,ly+oy); Cc.lineTo(px+ox,py+oy); Cc.stroke();
    Hc.globalCompositeOperation="source-over"; Hc.fillStyle=`rgba(${(150+90*hp)|0},${(150+90*hp)|0},${(150+90*hp)|0},${0.35*load})`; quad(Hc); Hc.fill();
    Hc.globalCompositeOperation="lighter"; Hc.strokeStyle=`rgba(255,255,255,${0.18*hp*load})`; Hc.lineWidth=3;
    Hc.beginPath(); Hc.moveTo(lx+ox,ly+oy); Hc.lineTo(px+ox,py+oy); Hc.moveTo(lx-ox,ly-oy); Hc.lineTo(px-ox,py-oy); Hc.stroke();
    Rc.globalCompositeOperation="source-over"; Rc.fillStyle=`rgba(45,45,45,${0.9*load})`; quad(Rc); Rc.fill();
    st.kx=px; st.ky=py;
  } else {
    const dry = load<0.5;                                    // 颜料快用完：飞白、断续的干笔
    // 先铺一条连续的"颜料体"，再在上面画笔毛纹理；干笔时颜料体变薄，只剩笔毛
    if(tool!=="fan" && st.lx!==undefined){
      const w = half*(tool==="flat"?0.95:0.78), ox=-sa*w, oy=ca*w;
      Cc.globalCompositeOperation="source-over";
      Cc.fillStyle = rgba(L.rgb, opacity*(dry?0.25:0.55));
      Cc.beginPath(); Cc.moveTo(st.lx+ox,st.ly+oy); Cc.lineTo(px+ox,py+oy); Cc.lineTo(px-ox,py-oy); Cc.lineTo(st.lx-ox,st.ly-oy); Cc.closePath(); Cc.fill();
    }
    const cols = st.classes.map(c=>rgba([L.rgb[0]+c.j[0],L.rgb[1]+c.j[1],L.rgb[2]+c.j[2]], opacity*c.load));
    Cc.globalCompositeOperation="source-over"; Cc.lineCap="round";
    for(let k=0;k<4;k++){
      Cc.strokeStyle = cols[k]; Cc.lineWidth = st.classes[k].w; Cc.beginPath();
      for(const b of st.bristles){
        if(b.c!==k) continue;
        const wx = px + (-sa*b.u + ca*b.v)*half, wy = py + (ca*b.u + sa*b.v)*half;
        if(b.px!==null && !(dry && Math.random()>load*2)){ Cc.moveTo(b.px,b.py); Cc.lineTo(wx,wy); }
        b.nx=wx; b.ny=wy;
      }
      Cc.stroke();
    }
    if(hp>0){
      Hc.globalCompositeOperation="lighter"; Hc.lineCap="round"; Hc.lineWidth=1.6;
      Hc.strokeStyle=`rgba(255,255,255,${0.05*hp*load})`; Hc.beginPath();
      for(const b of st.bristles){ if(b.px!==null){ Hc.moveTo(b.px,b.py); Hc.lineTo(b.nx,b.ny); } }
      Hc.stroke();
    }
    for(const b of st.bristles){ b.px=b.nx; b.py=b.ny; }
    Rc.globalCompositeOperation="source-over"; Rc.lineCap="round";
    Rc.strokeStyle=`rgba(55,55,55,${Math.min(1,0.3+opacity)})`; Rc.lineWidth=st.size*0.9;
    Rc.beginPath(); Rc.moveTo(st.lx ?? px, st.ly ?? py); Rc.lineTo(px,py); Rc.stroke();
    st.lx=px; st.ly=py;
  }
  if(!st.auto){
    const rate = 0.0011*(0.55+st.size/38)*(tool==="knife"?1.7:1)*(1-st.thin*0.6);
    L.amount = Math.max(0, L.amount - seg*rate);
  }
}
/* 揉开湿颜料：向局部平均色和"上游"颜色靠拢，只作用于未干的地方 */
function smearAt(x,y,r,strength,ang){
  r = Math.max(3, r|0);
  const x0=clamp((x-r)|0,0,CW-1), y0=clamp((y-r)|0,0,CH-1), x1=clamp((x+r)|0,0,CW-1), y1=clamp((y+r)|0,0,CH-1);
  const w=x1-x0+1, h=y1-y0+1; if(w<3||h<3) return;
  const img=Cc.getImageData(x0,y0,w,h), d=img.data;
  const rx0=(x0*HS)|0, ry0=(y0*HS)|0, rw=Math.max(1,(w*HS)|0), rh=Math.max(1,(h*HS)|0);
  const rd=Rc.getImageData(rx0,ry0,rw,rh).data;
  let s0=0,s1=0,s2=0,n=0;
  for(let i=0;i<d.length;i+=16){ s0+=d[i]; s1+=d[i+1]; s2+=d[i+2]; n++; }
  const avg=[s0/n,s1/n,s2/n];
  const ux=-Math.round(Math.cos(ang||0)*3), uy=-Math.round(Math.sin(ang||0)*3);
  const src = new Uint8ClampedArray(d);
  let touched=false;
  for(let j=0;j<h;j++) for(let i=0;i<w;i++){
    const fx=(x0+i-x)/r, fy=(y0+j-y)/r, f=1-(fx*fx+fy*fy); if(f<=0) continue;
    const rv = rd[(Math.min(rh-1,(j*HS)|0)*rw + Math.min(rw-1,(i*HS)|0))*4];
    const wet = WET(rv); if(wet<=0.02) continue;
    const t = f*strength*wet; touched=true;
    const si = clamp(i+ux,0,w-1), sj = clamp(j+uy,0,h-1), s=(sj*w+si)*4, o=(j*w+i)*4;
    for(let c=0;c<3;c++){ const target = avg[c]*0.4 + src[s+c]*0.6; d[o+c] = src[o+c] + (target-src[o+c])*t; }
  }
  if(touched){ Cc.putImageData(img,x0,y0); canvasDirty = true; }
}

/* ---------- 自动笔触（刷底料 / 铺底色 时演示给你看） ---------- */
const autoQueue = [];
function queueStrokes(paths, opts){ paths.forEach(p=>autoQueue.push({p, i:1, opts, st:null})); }
function runAuto(){
  let budget = 900;
  while(budget>0 && autoQueue.length){
    const job = autoQueue[0];
    if(!job.st){ job.st = newStroke(job.opts.tool, job.p[0][0], job.p[0][1], {rgb:job.opts.rgb.slice(), amount:1}, {size:job.opts.size, thin:job.opts.thin, auto:true}); }
    const [x,y] = job.p[job.i];
    budget -= Math.hypot(x-job.st.x, y-job.st.y);
    strokeTo(job.st, x, y);
    job.i++;
    if(job.i>=job.p.length){ autoQueue.shift(); if(job.opts.onDone) job.opts.onDone(); }
  }
}
function wavyPath(x0,y0,x1,y1,seg=14,amp=6){
  const pts=[]; for(let i=0;i<=seg;i++){ const t=i/seg; pts.push([x0+(x1-x0)*t+(Math.random()-0.5)*amp, y0+(y1-y0)*t+(Math.random()-0.5)*amp]); } return pts;
}

/* ---------- 撤销 ---------- */
const undoStack = [];
function snapshot(){
  const s = [colorCv,heightCv,roughCv].map(c=>{ const k=makeCanvas(c.width,c.height); k.getContext("2d").drawImage(c,0,0); return k; });
  undoStack.push(s); if(undoStack.length>12) undoStack.shift();
}
function undo(){
  const s = undoStack.pop(); if(!s){ toast("没有可以撤销的了"); return; }
  autoQueue.length = 0;
  [[Cc,colorCv],[Hc,heightCv],[Rc,roughCv]].forEach(([ctx],i)=>{ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.globalCompositeOperation="copy"; ctx.globalAlpha=1; ctx.filter="none"; ctx.drawImage(s[i],0,0); ctx.restore(); });
  canvasDirty = true; toast("↩ 撤销了一步");
}

/* ---------- 全局操作 ---------- */
function doGesso(){
  snapshot();
  Hc.globalCompositeOperation="source-over"; Hc.fillStyle="rgba(95,95,95,.65)"; Hc.fillRect(0,0,CW,CH);
  const opts = {tool:"flat", size:110, thin:0.08, rgb:[241,236,224]};
  const paths=[];
  for(let y=-10;y<CH+60;y+=70) paths.push(wavyPath(-60,y,CW+60,y+(Math.random()-0.5)*30,10,4));
  for(let x=-10;x<CW+60;x+=80) paths.push(wavyPath(x,-60,x+(Math.random()-0.5)*30,CH+60,8,4));
  queueStrokes(paths, {...opts, onDone:null});
  autoQueue[autoQueue.length-1].opts = {...opts, onDone:()=>{ Rc.fillStyle="rgb(225,225,225)"; Rc.fillRect(0,0,CW,CH); canvasDirty=true; }};
  state.primed = true; markDone(0);
  toast("刷石膏底料：横一遍、竖一遍，薄而均匀");
}
function doTone(){
  const L = loads[brush.tool==="soft"||brush.tool==="knife" ? "flat" : brush.tool];
  if(L.amount<0.05){ toast("笔上还没有颜料：先在调色板上蘸一点（推荐熟赭）"); return; }
  snapshot();
  const opts = {tool:"flat", size:120, thin:Math.max(0.72, brush.thin), rgb:L.rgb.slice()};
  const paths=[];
  for(let k=-CH;k<CW+CH;k+=85) paths.push(wavyPath(k,-40,k+CH*0.55,CH+40,10,10));
  for(let k=-CH;k<CW+CH;k+=130) paths.push(wavyPath(k+CH*0.6,-40,k,CH+40,10,10));
  queueStrokes(paths, opts);
  markDone(3); toast("用稀释的颜色斜向扫满整张画布");
}
function doDry(){
  snapshot(); autoQueue.length=0;
  Rc.globalCompositeOperation="source-over"; Rc.fillStyle="rgb(212,212,212)"; Rc.fillRect(0,0,CW,CH);
  canvasDirty = true; markDone(9);
  toast("⏳ 三天过去了……颜料已经干透，画面从湿亮变得哑光");
}
function doVarnish(){
  snapshot();
  const tmp = makeCanvas(CW,CH); tmp.getContext("2d").drawImage(colorCv,0,0);
  Cc.save(); Cc.filter="saturate(1.12) contrast(1.05)"; Cc.globalCompositeOperation="copy"; Cc.drawImage(tmp,0,0); Cc.restore();
  Rc.globalCompositeOperation="source-over"; Rc.fillStyle="rgb(125,125,125)"; Rc.fillRect(0,0,CW,CH);
  paintMat.clearcoat = 0.75; state.varnished = true; canvasDirty = true; markDone(10);
  toast("✨ 上好光油了：颜色重新饱满，表面泛起柔和的光泽");
}
function doSign(){
  const inp = $("a3SignName"); const name = (inp && inp.value.trim()) || "Atelier";
  state.signName = name;
  snapshot();
  const L = loads.round;
  const col = L.amount>0.05 ? L.rgb : [92,32,22];
  Cc.save(); Cc.font = "italic 30px 'Brush Script MT','Segoe Script',Georgia,cursive"; Cc.textAlign="right";
  Cc.fillStyle = rgba(col,0.92); Cc.fillText(name + " · " + new Date().getFullYear(), CW-34, CH-30); Cc.restore();
  Rc.save(); Rc.font="italic 30px Georgia"; Rc.textAlign="right"; Rc.fillStyle="rgb(55,55,55)"; Rc.fillText(name+" · 0000",CW-34,CH-30); Rc.restore();
  canvasDirty = true; toast(`✍ 签上了：${name}`);
}
function toggleFrame(force){
  state.framed = force ?? !state.framed; easelFrame.visible = state.framed;
  if(state.framed) toast("🖼 装进了金色画框");
}
function hangOnWall(){
  if(!state.framed) toggleFrame(true);
  const url = colorCv.toDataURL("image/jpeg",0.85);
  // 填第一个空位；满了就替换最早的一幅
  let idx = galleryItems.findIndex(x=>!x);
  if(idx<0){ if(galleryItems.length>=SLOTS.length) galleryItems.shift(); idx = galleryItems.length; }
  galleryItems[idx] = {img:url, date:Date.now(), by:state.signName};
  try{ localStorage.setItem("atelier3d.gallery", JSON.stringify(galleryItems)); }catch{ toast("浏览器存储已满，这幅只在本次挂着"); }
  refreshGallery(); markDone(11);
  setTimeout(()=>{ viewSlot(idx); toast("🏛 挂好了！欢迎来到你自己的画廊。点「新画布」开始下一幅"); },150);
}
function newCanvas(){
  if(!confirm("换一张新的空白画布？（当前画面会被收走，没挂到墙上的话就不在了）")) return;
  autoQueue.length=0; undoStack.length=0; linenGround(); toggleFrame(false);
  state.varnished=false; state.primed=false; state.done.clear(); setStage(0); setMode("paint");
}
function savePng(){
  const a=document.createElement("a"); a.download=`我的油画_${new Date().toISOString().slice(0,10)}.png`; a.href=colorCv.toDataURL("image/png"); a.click();
}

/* ---------- 调色板混色引擎 ---------- */
let palStroke = null;
function palPick(pi, toolName){
  const b = blobs[pi]; if(!b || b.amount<=0) return;
  const L = loads[toolName], pg = PIGMENTS[pi];
  if(toolName==="soft"){ toast("软毛调和笔不蘸颜料，用来在画布上揉开边缘"); return; }
  L.rgb = L.amount>0.15 ? mixPaint(L.rgb, pg.rgb, 0.6) : pg.rgb.slice();
  L.amount = Math.min(1, L.amount + (toolName==="knife"?0.7:0.55));
  b.amount = Math.max(0, b.amount - (toolName==="knife"?0.12:0.06));
  updateLoadUI();
}
function palDab(px,py,first){
  const toolName = brush.tool==="soft" ? null : brush.tool;
  if(!toolName) return;
  const L = loads[toolName], knife = toolName==="knife";
  const r = knife ? 13 : clamp(brush.size*0.35,4,15);
  const x0=clamp((px-r)|0,0,PW-1), x1=clamp((px+r)|0,0,PW-1), y0=clamp((py-r)|0,0,PH-1), y1=clamp((py+r)|0,0,PH-1);
  // 先看笔下已有多少颜料、平均是什么色
  let s0=0,s1=0,s2=0,cov=0,tot=0;
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const fx=(x-px)/r, fy=(y-py)/r; if(fx*fx+fy*fy>1) continue;
    tot++; const o=(y*PW+x)*4; if(PD[o+3]>0){ s0+=PD[o]; s1+=PD[o+1]; s2+=PD[o+2]; cov++; }
  }
  if(!tot) return;
  const coverage = cov/tot, under = cov ? [s0/cov|0,s1/cov|0,s2/cov|0] : null;
  const loaded = L.amount>0.04;
  const strength = knife ? 0.55 : 0.4;
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    const fx=(x-px)/r, fy=(y-py)/r, d2=fx*fx+fy*fy; if(d2>1) continue;
    const f=1-d2, o=(y*PW+x)*4;
    if(PD[o+3]>0){
      const cur=[PD[o],PD[o+1],PD[o+2]];
      const target = loaded ? L.rgb : under;
      const m = mixPaint(cur, target, f*(loaded?strength*Math.min(1,L.amount*2):0.3));
      PD[o]=m[0]; PD[o+1]=m[1]; PD[o+2]=m[2];
    } else if(loaded && f > 0.2+Math.random()*0.35){
      PD[o]=L.rgb[0]; PD[o+1]=L.rgb[1]; PD[o+2]=L.rgb[2]; PD[o+3]=255;
    }
  }
  if(loaded) L.amount = Math.max(0, L.amount - (knife?0.008:0.014)*(1-coverage*0.7));
  if(under){
    // 刀/笔也会带走调色板上的颜料：这就是"调色"
    const pickup = (knife?0.3:0.45)*coverage*(first?1.6:1);
    L.rgb = loaded ? mixPaint(L.rgb, under, Math.min(0.9,pickup)) : under.slice();
    if(first && !knife) L.amount = Math.max(L.amount, Math.min(1, coverage*1.2));   // 画笔点进颜料堆＝饱蘸
    else if(L.amount<0.6) L.amount = Math.min(0.6, L.amount + coverage*(knife?0.05:0.07));
  }
  palDirty = true; updateLoadUI();
}
function scrapePalette(){ PD.fill(0); palDirty = true; toast("🧹 调色板中间刮干净了"); }
function washBrush(){
  const t = brush.tool==="knife" ? null : brush.tool;
  if(!t){ wipeKnife(); return; }
  const L = loads[t];
  if(L.amount>0.02 || L.rgb.some((v,i)=>Math.abs(v-BRISTLE_RGB[i])>4)){
    const lm = palette.userData.turps.userData.liquidMat;
    lm.color.lerp(new THREE.Color(rgbHex(L.rgb)), 0.08);
  }
  L.amount=0; L.rgb=BRISTLE_RGB.slice(); updateLoadUI(); toast(`🫙 在松节油里涮干净了${TOOLS[t].name}`);
}
function wipeKnife(){ loads.knife.amount=0; loads.knife.rgb=[205,205,200]; updateLoadUI(); toast("🧽 用抹布擦干净了调色刀"); }

/* ==================== 相机模式 ==================== */
let mode = "roam";
const tween = { active:false, t:0, dur:0.9, fromP:new THREE.Vector3(), fromT:new THREE.Vector3(), toP:new THREE.Vector3(), toT:new THREE.Vector3() };
const curTarget = controls.target.clone();
const HOME_P = camera.position.clone(), HOME_T = controls.target.clone();
const paintView = { dist:1.0, panX:0, panY:0 };
function paintPose(){
  // 站远时画布偏右、左边看得见静物；凑近时自动对准画布中央
  const side = clamp((paintView.dist-0.42)/0.58, 0, 1.3);
  const look = new THREE.Vector3(-0.24*side+paintView.panX, CANVAS_Y-0.04*side+paintView.panY, CANVAS_Z);
  const p = new THREE.Vector3(-0.34*side+paintView.panX*0.85, CANVAS_Y+0.04*side+paintView.panY, CANVAS_Z+0.06).add(new THREE.Vector3(0,0,1.4*paintView.dist));
  return [p, look];
}
function palettePose(){
  const look = new THREE.Vector3(-0.02,TAB_TOP,-0.01).applyMatrix4(taboret.matrixWorld);
  const p = new THREE.Vector3(-0.02,TAB_TOP+0.5,0.3).applyMatrix4(taboret.matrixWorld);
  return [p, look];
}
function flyTo(p, t, dur=0.9){
  tween.fromP.copy(camera.position); tween.fromT.copy(curTarget);
  tween.toP.copy(p); tween.toT.copy(t); tween.t=0; tween.dur=dur; tween.active=true;
}
function setMode(m){
  mode = m;
  controls.enabled = (m==="roam");
  root.querySelectorAll("#a3Modes button").forEach(b=>b.classList.toggle("active", b.dataset.mode===m));
  if(m==="paint"){ const [p,t]=paintPose(); flyTo(p,t); }
  else if(m==="palette"){ taboret.updateMatrixWorld(); const [p,t]=palettePose(); flyTo(p,t); }
  else if(m==="roam") flyTo(HOME_P, HOME_T);
  setHint();
}
function viewSlot(i){
  const s = gallery[i].g; s.updateMatrixWorld();
  const look = new THREE.Vector3(0,0,0).applyMatrix4(s.matrixWorld);
  const p = new THREE.Vector3(0,-0.05,1.7).applyMatrix4(s.matrixWorld);
  mode = "view"; controls.enabled=false;
  root.querySelectorAll("#a3Modes button").forEach(b=>b.classList.remove("active"));
  flyTo(p, look, 1.2); setHint();
}
function setHint(){
  const h = {
    roam:"拖动旋转 · 滚轮缩放 · 右键平移 · 点画架去作画，点调色台去调色，点墙上的画框细看",
    paint:"左键在画布上作画 · 在手中调色板上蘸色/调色 · 滚轮靠近或退后 · 右键拖动平移 · Ctrl+Z 撤销",
    palette:"点颜料管挤颜料 · 用调色刀从颜料坨拖到中间调色 · 换画笔点调好的颜色蘸取 · 点笔筒换笔，点松节油洗笔，点抹布擦刀",
    view:"欣赏作品 · 按 1 或点「漫游画室」回去",
  }[mode];
  $("a3Hint").textContent = h;
}

/* ---------- 手中的调色板：作画模式时举在左下方 ---------- */
let handT = 0;
const restMat = new THREE.Matrix4(), handLocal = new THREE.Matrix4(), tmpM = new THREE.Matrix4();
const restP=new THREE.Vector3(), restQ=new THREE.Quaternion(), handP=new THREE.Vector3(), handQ=new THREE.Quaternion(), sc=new THREE.Vector3();
handLocal.compose(new THREE.Vector3(-0.43,-0.3,-0.86), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.95,0.3,0.12,"XYZ")), new THREE.Vector3(1,1,1));
const restLocal = new THREE.Matrix4().compose(new THREE.Vector3(-0.19,TAB_TOP+0.001,0.0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0.15,0)), new THREE.Vector3(1,1,1));
function updatePalettePose(dt){
  const goal = mode==="paint" ? 1 : 0;
  handT += (goal-handT)*Math.min(1,dt*5);
  taboret.updateMatrixWorld();
  restMat.multiplyMatrices(taboret.matrixWorld, restLocal); restMat.decompose(restP,restQ,sc);
  tmpM.multiplyMatrices(camera.matrixWorld, handLocal); tmpM.decompose(handP,handQ,sc);
  const e = handT*handT*(3-2*handT);
  palette.position.lerpVectors(restP,handP,e);
  palette.quaternion.slerpQuaternions(restQ,handQ,e);
  // 举起时略微抬高，避免穿过桌面
  if(e>0.02 && e<0.98) palette.position.y += Math.sin(e*Math.PI)*0.25;
}

/* ==================== 指针交互 ==================== */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const canvasPlane = new THREE.Plane(), palPlane = new THREE.Plane(), tmpV = new THREE.Vector3();
let drag = null, hover = null, lastPointer = null;
function setNdc(e){
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc, camera);
}
function pick(e){
  setNdc(e);
  const objs = [canvasMesh, ...interactive.filter(o=>o.visible!==false)];
  const hits = ray.intersectObjects(objs, true);
  for(const h of hits){
    if(h.object===canvasMesh){ if(h.face.materialIndex===4) return {kind:"canvas", hit:h}; return {kind:"easel", hit:h}; }
    if(h.object.userData.kind) return {kind:h.object.userData.kind, data:h.object.userData.data, hit:h, obj:h.object};
  }
  // 漫游时点到画架/调色台的其他部分也算
  const h2 = ray.intersectObjects([easel, taboret], true)[0];
  if(h2) return {kind: easel.getObjectById(h2.object.id) ? "easel" : "taboretBody", hit:h2};
  return null;
}
function canvasPx(){
  canvasMesh.updateMatrixWorld();
  const n = new THREE.Vector3(0,0,1).transformDirection(canvasMesh.matrixWorld);
  const p = new THREE.Vector3(0,0,CANVAS_T/2).applyMatrix4(canvasMesh.matrixWorld);
  canvasPlane.setFromNormalAndCoplanarPoint(n,p);
  if(!ray.ray.intersectPlane(canvasPlane,tmpV)) return null;
  const l = canvasMesh.worldToLocal(tmpV.clone());
  return [(l.x/CANVAS_W+0.5)*CW, (0.5-l.y/CANVAS_H)*CH, tmpV.clone(), n];
}
function palettePx(){
  palette.updateMatrixWorld();
  const n = new THREE.Vector3(0,1,0).transformDirection(palette.matrixWorld);
  const p = new THREE.Vector3(0,PAL_TOP,0).applyMatrix4(palette.matrixWorld);
  palPlane.setFromNormalAndCoplanarPoint(n,p);
  if(!ray.ray.intersectPlane(palPlane,tmpV)) return null;
  const l = palette.worldToLocal(tmpV.clone());
  return [(l.x+PAL_W/2)/PAL_W*PW, (PAL_H/2+l.z)/PAL_H*PH, tmpV.clone(), n];
}
const dom = renderer.domElement;
dom.addEventListener("contextmenu", e=>e.preventDefault());
dom.addEventListener("pointerdown", e=>{
  lastPointer = e;
  if(mode==="roam" || mode==="view"){ drag = {type:"click", x:e.clientX, y:e.clientY}; return; }
  if(e.button===2 || e.button===1){
    if(mode==="paint"){ drag = {type:"pan", x:e.clientX, y:e.clientY, px:paintView.panX, py:paintView.panY}; dom.setPointerCapture(e.pointerId); }
    return;
  }
  const pk = pick(e); if(!pk) return;
  dom.setPointerCapture(e.pointerId);
  switch(pk.kind){
    case "canvas":{
      if(mode!=="paint") return;
      const c = canvasPx(); if(!c) return;
      if(autoQueue.length){ toast("等一下，上一步还在进行中"); return; }
      const L = loads[brush.tool];
      if(brush.tool!=="soft" && L.amount<0.02) toast("笔上没有颜料：在调色板上蘸一点（空笔只会推开未干的颜料）");
      snapshot();
      drag = {type:"canvas", st:newStroke(brush.tool, c[0], c[1], L)};
      stamp(drag.st, c[0], c[1], 0); canvasDirty = true;
      break;
    }
    case "blob":{
      palPick(pk.data, brush.tool);
      const c = palettePx(); drag = {type:"palette", last:c && [c[0],c[1]]};
      break;
    }
    case "palette":{
      const c = palettePx(); if(!c) return;
      drag = {type:"palette", last:[c[0],c[1]]}; palDab(c[0],c[1],true);
      break;
    }
    case "tube": squeeze(pk.data); break;
    case "jarTool": selectTool(pk.data); break;
    case "turps": washBrush(); break;
    case "rag": wipeKnife(); break;
    case "easel": if(mode!=="paint") setMode("paint"); break;
    case "slot": viewSlot(pk.data); break;
  }
});
dom.addEventListener("pointermove", e=>{
  lastPointer = e;
  if(!drag) return;
  if(drag.type==="pan"){
    const k = 0.0016*paintView.dist;
    paintView.panX = clamp(drag.px - (e.clientX-drag.x)*k, -0.45, 0.45);
    paintView.panY = clamp(drag.py + (e.clientY-drag.y)*k, -0.35, 0.35);
    const [p,t] = paintPose(); camera.position.copy(p); curTarget.copy(t); camera.lookAt(t);
    return;
  }
  setNdc(e);
  if(drag.type==="canvas"){ const c=canvasPx(); if(c) strokeTo(drag.st, c[0], c[1]); }
  else if(drag.type==="palette"){
    const c=palettePx(); if(!c) return;
    const last = drag.last; drag.last=[c[0],c[1]];
    if(!last){ palDab(c[0],c[1],false); return; }
    const d = Math.hypot(c[0]-last[0], c[1]-last[1]), n=Math.ceil(d/3);
    for(let i=1;i<=n;i++) palDab(last[0]+(c[0]-last[0])*i/n, last[1]+(c[1]-last[1])*i/n, false);
  }
});
function endDrag(e){
  if(drag && drag.type==="click" && e && Math.hypot(e.clientX-drag.x, e.clientY-drag.y)<5){
    const pk = pick(e);
    if(pk){
      if(pk.kind==="canvas" || pk.kind==="easel") setMode("paint");
      else if(["palette","blob","tube","jarTool","turps","rag","taboretBody"].includes(pk.kind)) setMode("palette");
      else if(pk.kind==="slot") viewSlot(pk.data);
    }
  }
  if(drag && drag.type==="canvas"){ updateLoadUI(); }
  drag = null;
}
dom.addEventListener("pointerup", endDrag);
dom.addEventListener("pointercancel", ()=>{ drag=null; });
dom.addEventListener("pointerleave", ()=>{ lastPointer=null; });
dom.addEventListener("wheel", e=>{
  if(mode==="paint"){
    e.preventDefault();
    paintView.dist = clamp(paintView.dist*(e.deltaY>0?1.08:1/1.08), 0.42, 1.8);
    const [p,t] = paintPose(); flyTo(p,t,0.18);
  }
},{passive:false});

/* ---------- 悬停：提示文字 + 3D 笔跟随 ---------- */
const tipBox = $("a3Tip");
const Y = new THREE.Vector3(0,1,0);
function updateHover(){
  Object.values(cursorTools).forEach(g=>g.visible=false);
  tipBox.style.display="none";
  dom.style.cursor = mode==="roam" ? "grab" : "default";
  if(!lastPointer || tween.active || drag?.type==="pan") return;
  const e = lastPointer;
  let surf = null, tip = "";
  if(drag?.type==="canvas"){ setNdc(e); surf = canvasPx(); }
  else if(drag?.type==="palette"){ setNdc(e); surf = palettePx(); }
  else{
    const pk = pick(e);
    if(pk){
      if(pk.kind==="canvas" && mode==="paint"){ surf = canvasPx(); }
      else if((pk.kind==="palette"||pk.kind==="blob") && mode!=="roam"){ surf = palettePx(); if(pk.kind==="blob"){ const p=PIGMENTS[pk.data]; tip=`${p.name} ${p.en} · 点击蘸取`; } }
      else if(pk.kind==="tube"){ const p=PIGMENTS[pk.data]; tip=`${p.name} ${p.en} · 点击挤到调色板`; }
      else if(pk.kind==="jarTool"){ const t=TOOLS[pk.data]; tip=`${t.name} · ${t.tip}`; }
      else if(pk.kind==="turps") tip="松节油 · 点击洗笔";
      else if(pk.kind==="rag") tip="抹布 · 点击擦调色刀";
      else if(pk.kind==="slot") tip = galleryItems[pk.data] ? `你的作品${galleryItems[pk.data].by?" · "+galleryItems[pk.data].by:""} · ${new Date(galleryItems[pk.data].date).toLocaleDateString()}` : "空画框 · 等你的作品挂上来";
      else if(mode==="roam" && (pk.kind==="canvas"||pk.kind==="easel")) tip="画架 · 点击走过去作画";
      else if(mode==="roam" && pk.kind==="taboretBody") tip="调色台 · 点击去调色";
      if(tip || pk.kind!=="taboretBody") dom.style.cursor = "pointer";
    }
  }
  if(tip){
    const r = view.getBoundingClientRect();
    tipBox.textContent = tip; tipBox.style.display="block";
    tipBox.style.left = (e.clientX-r.left+16)+"px"; tipBox.style.top = (e.clientY-r.top+12)+"px";
  }
  if(surf){
    dom.style.cursor = "crosshair";
    const g = cursorTools[brush.tool]; g.visible = true;
    const hit = surf[2], n = surf[3];
    const toCam = camera.position.clone().sub(hit);
    const dist = toCam.length();
    const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const down = new THREE.Vector3(0,-1,0).applyQuaternion(camera.quaternion);
    const axis = toCam.normalize().add(right.multiplyScalar(0.55)).add(down.multiplyScalar(0.35)).normalize();
    if(axis.dot(n)<0.2) axis.addScaledVector(n,0.4).normalize();
    const dirToSurf = axis.clone().negate();
    g.quaternion.setFromUnitVectors(Y, dirToSurf);
    if(brush.tool==="flat"||brush.tool==="fan"||brush.tool==="knife"){
      const q = new THREE.Quaternion().setFromAxisAngle(dirToSurf, drag?.st?.ang!=null ? -drag.st.ang : 0.3);
      g.quaternion.premultiply(q);
    }
    const press = drag ? 0.004 : 0.0;
    g.position.copy(hit).addScaledVector(dirToSurf, -(g.userData.tip - press)).addScaledVector(n, 0.001);
    void dist;
  }
}

/* ---------- 工具与笔上颜料的显示 ---------- */
function updateLoadUI(){
  const t = brush.tool, L = loads[t];
  const sw = $("a3LoadSw"), bar = $("a3LoadBar").firstElementChild;
  const has = L.amount>0.01;
  sw.style.background = has ? rgbHex(L.rgb) : "transparent";
  sw.classList.toggle("empty", !has);
  const pg = has ? nearestPigment(L.rgb) : null;
  $("a3LoadName").textContent = t==="soft" ? "软毛调和笔 · 不蘸颜料，揉开湿边" :
    `${TOOLS[t].name} · ${has ? (pg ? pg.name : "调和色 "+rgbHex(L.rgb)) : (t==="knife"?"干净的刀":"干净")}`;
  bar.style.width = (t==="soft"?0:Math.round(clamp(L.amount,0,1)*100))+"%";
  bar.style.background = has ? rgbHex(L.rgb) : "#555";
  // 3D 笔头颜色 = 笔上的颜料
  const tint = (g, ld)=>{ const c = ld.amount>0.01 ? mixPaint(BRISTLE_RGB, ld.rgb, Math.min(1,0.55+ld.amount)) : (g.userData.type==="knife"?[205,205,200]:BRISTLE_RGB); g.userData.tuftMat.color.set(rgbHex(c)); if(g.userData.type==="knife") g.userData.tipMesh.visible = ld.amount>0.01; };
  Object.keys(TOOLS).forEach(k=>{ tint(cursorTools[k], loads[k]); tint(jarTools[k], loads[k]); });
}
function selectTool(t){
  brush.tool = t;
  root.querySelectorAll("#a3Tools .brush-btn").forEach(b=>b.classList.toggle("active", b.dataset.tool===t));
  updateLoadUI();
  if(t==="knife") toast("调色刀：在调色板上把颜料推开、来回刮匀；在画布上可以厚涂");
}

/* ==================== 流程面板 ==================== */
function markDone(i){ state.done.add(i); renderStages(); }
function setStage(i){
  state.stage = i; const s = STAGES[i];
  if(s.preset){
    selectTool(s.preset.tool);
    brush.size = s.preset.size; brush.thin = s.preset.thin/100;
    $("a3Size").value = s.preset.size; $("a3SizeVal").textContent = s.preset.size;
    $("a3Thin").value = s.preset.thin; $("a3ThinVal").textContent = s.preset.thin+"%";
  }
  renderStages();
}
function renderStages(){
  const ol = $("a3Stages");
  ol.innerHTML = STAGES.map((s,i)=>`<li class="${i===state.stage?"cur":""} ${state.done.has(i)?"done":""}" data-i="${i}"><span class="n">${state.done.has(i)?"✓":i+1}</span>${s.t.split(" · ")[0]}</li>`).join("");
  const s = STAGES[state.stage];
  const acts = (s.actions||[]).map(([k,label])=>`<button class="action-btn" data-sact="${k}">${label}</button>`).join("");
  const pre = s.preset ? `<div class="a3-preset">已为你换好：${TOOLS[s.preset.tool].name} · 大小 ${s.preset.size} · 稀释 ${s.preset.thin}%</div>` : "";
  const sign = s.sign ? `<input id="a3SignName" class="a3-input" placeholder="你的签名" value="${state.signName||""}">` : "";
  $("a3StageCard").innerHTML = `
    <div class="a3-stage-title">${state.stage+1}. ${s.t}<span>${s.en}</span></div>
    <p>${s.d}</p>${pre}${sign}
    <div class="a3-grid1">${acts}</div>
    <div class="a3-nav">
      <button class="action-btn" data-nav="-1" ${state.stage===0?"disabled":""}>← 上一步</button>
      <button class="action-btn" data-nav="1" ${state.stage===STAGES.length-1?"disabled":""}>下一步 →</button>
    </div>`;
}
$("a3Stages").addEventListener("click", e=>{ const li=e.target.closest("li"); if(li) setStage(+li.dataset.i); });
$("a3StageCard").addEventListener("click", e=>{
  const nav = e.target.closest("[data-nav]");
  if(nav){ markDone(state.stage); setStage(clamp(state.stage + +nav.dataset.nav, 0, STAGES.length-1)); return; }
  const b = e.target.closest("[data-sact]"); if(!b) return;
  const k = b.dataset.sact;
  if(k.startsWith("mode:")) return setMode(k.slice(5));
  ({
    gesso:()=>{ setMode("paint"); doGesso(); },
    ref:()=>refInput.click(),
    refClear:()=>{ refBoard.visible=false; toast("移除了参考图"); },
    squeezeAll:()=>{ setMode("palette"); [0,3,4,5,6,7,9,11].forEach((pi,k)=>setTimeout(()=>squeeze(pi),300+k*260)); markDone(2); },
    tone:()=>{ setMode("paint"); doTone(); },
    dry:doDry, varnish:()=>{ setMode("paint"); doVarnish(); },
    sign:()=>{ setMode("paint"); doSign(); },
    frame:()=>{ setMode("paint"); toggleFrame(); },
    hang:hangOnWall,
  })[k]?.();
});
const refInput = document.createElement("input"); refInput.type="file"; refInput.accept="image/*";
refInput.addEventListener("change", e=>{ const f=e.target.files[0]; if(f){ const r=new FileReader(); r.onload=()=>setReference(r.result); r.readAsDataURL(f); } refInput.value=""; });
function setReference(url){
  new THREE.TextureLoader().load(url, t=>{
    t.colorSpace = THREE.SRGBColorSpace;
    refMat.map = t; refMat.needsUpdate = true;
    const ar = t.image.width/t.image.height, ph = refBoard.userData.photo;
    ph.scale.set(Math.min(1, ar/(0.29/0.22)), Math.min(1, (0.29/0.22)/ar), 1);
    refBoard.visible = true; markDone(1);
    toast("🖼 参考图夹在画架右边了");
  });
}

/* ---------- 左侧控件 ---------- */
$("a3Tools").innerHTML = Object.entries(TOOLS).map(([k,t])=>`<button class="brush-btn" data-tool="${k}" title="${t.tip}"><span class="icon">${t.icon}</span>${t.name}</button>`).join("");
$("a3Tools").addEventListener("click", e=>{ const b=e.target.closest("[data-tool]"); if(b) selectTool(b.dataset.tool); });
$("a3Tubes").innerHTML = PIGMENTS.map((p,i)=>`<button class="a3-tube" data-pi="${i}" title="${p.name} ${p.en}"><i style="background:${p.hex}"></i>${p.name}</button>`).join("");
$("a3Tubes").addEventListener("click", e=>{ const b=e.target.closest("[data-pi]"); if(b) squeeze(+b.dataset.pi); });
$("a3Size").addEventListener("input", e=>{ brush.size=+e.target.value; $("a3SizeVal").textContent=e.target.value; });
$("a3Thin").addEventListener("input", e=>{ brush.thin=e.target.value/100; $("a3ThinVal").textContent=e.target.value+"%"; });
root.querySelector("#a3Side").addEventListener("click", e=>{
  const b = e.target.closest("[data-act]");
  if(b) ({wash:washBrush, wipe:wipeKnife, scrape:scrapePalette, undo, dry:doDry, save:savePng, new:newCanvas})[b.dataset.act]();
  const l = e.target.closest("[data-light]");
  if(l){ setLight(l.dataset.light); root.querySelectorAll("[data-light]").forEach(x=>x.classList.toggle("active", x===l)); }
});
root.querySelectorAll("#a3Modes button").forEach(b=>b.addEventListener("click", ()=>setMode(b.dataset.mode)));
document.addEventListener("keydown", e=>{
  if(!visible) return;
  const tg = e.target.tagName; if(tg==="INPUT"||tg==="TEXTAREA"||tg==="SELECT") return;
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z"){ e.preventDefault(); undo(); return; }
  if(e.key==="1") setMode("roam"); else if(e.key==="2") setMode("paint"); else if(e.key==="3") setMode("palette");
  else if(e.key==="Escape") setMode("roam");
  else if(e.key==="[" || e.key==="]"){ brush.size=clamp(brush.size+(e.key==="]"?2:-2),2,90); $("a3Size").value=brush.size; $("a3SizeVal").textContent=brush.size; }
});
function setLight(kind){
  const night = kind==="night";
  sun.intensity = night ? 0 : 3.2;
  windowLight.intensity = night ? 0.9 : 7; windowLight.color.set(night ? "#7d8fb8" : "#eef2fa");
  hemi.intensity = night ? 0.12 : 0.55;
  fill.intensity = night ? 0.12 : 0.5;
  lampLight.intensity = night ? 6 : 0;
  scene.userData.lamp.userData.shade.material.emissiveIntensity = night ? 0.9 : 0;
  scene.environmentIntensity = night ? 0.1 : 0.28;
  skyMeshTint(night);
}
function skyMeshTint(night){ scene.traverse(o=>{ if(o.isMesh && o.material.map===skyTex) o.material.color.set(night?"#2a3550":"#ffffff"); }); }

let toastTimer=0;
function toast(html){ const t=$("a3Toast"); t.innerHTML=html; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),2600); }

/* ==================== 渲染循环 ==================== */
function resize(){
  const w = view.clientWidth, h = view.clientHeight; if(!w||!h) return;
  renderer.setSize(w,h,false); camera.aspect = w/h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
let lastT = performance.now(), running = false;
const clampV = v=>{ v.x=clamp(v.x,RX0+0.3,RX1-0.3); v.y=clamp(v.y,0.25,RH-0.2); v.z=clamp(v.z,RZ0+0.3,RZ1-0.3); };
function frame(now){
  if(!visible){ running=false; return; }
  requestAnimationFrame(frame);
  tick(now);
}
function tick(now){
  const dt = Math.min(0.05,(now-lastT)/1000); lastT = now;
  runAuto();
  if(tween.active){
    tween.t += dt/tween.dur; const k = tween.t>=1 ? 1 : 1-Math.pow(1-tween.t,3);
    camera.position.lerpVectors(tween.fromP,tween.toP,k); curTarget.lerpVectors(tween.fromT,tween.toT,k);
    camera.lookAt(curTarget);
    if(tween.t>=1){ tween.active=false; if(mode==="roam"){ controls.target.copy(curTarget); controls.update(); } }
  } else if(mode==="roam"){
    controls.update(); clampV(camera.position); curTarget.copy(controls.target);
  }
  camera.updateMatrixWorld();
  updatePalettePose(dt);
  blobs.forEach(b=>{ if(!b) return; const s=blobScale(b); b.mesh.scale.setScalar(b.mesh.scale.x + (s-b.mesh.scale.x)*Math.min(1,dt*10)); b.mesh.visible = s>0.001; });
  tubes.forEach(t=>{ const q=t.userData.squeezeT||0; if(q>0){ t.userData.squeezeT=Math.max(0,q-dt*3); const s=1-Math.sin(q*Math.PI)*0.18; t.scale.set(1+(1-s)*0.6,s,1+(1-s)*0.6); } });
  updateHover();
  if(canvasDirty){ colorTex.needsUpdate = heightTex.needsUpdate = roughTex.needsUpdate = true; canvasDirty = false; }
  if(palDirty){ redrawPalette(); palDirty = false; }
  renderer.render(scene,camera);
}
function resume(){ resize(); if(!running){ running=true; lastT=performance.now(); requestAnimationFrame(frame); } }

/* ---------- 开场 ---------- */
linenGround(); redrawPalette(); renderStages(); selectTool("round"); setHint();
Object.values(cursorTools).forEach(g=>g.visible=true); squeeze(0,true); blobs[0].amount=0; tubes[0].userData.squeezeT=0;
renderer.compile(scene, camera);
Object.values(cursorTools).forEach(g=>g.visible=false);
root.querySelector('#a3Modes [data-mode="roam"]').classList.add("active");
$("a3Loading").style.display = "none";
resume();
if(pendingRef) setReference(pendingRef);
setTimeout(()=>toast("欢迎来到你的画室 —— 从左边「作画流程」第 1 步开始，或者点画架走过去"), 400);

// 调试口：方便自动化测试
window.__atelier3d = { scene, camera, setMode, squeeze, palPick, loads, brush, mixPaint, doGesso, state, setStage, selectTool,
  paintAt:(pts)=>{ const st=newStroke(brush.tool,pts[0][0],pts[0][1],loads[brush.tool]); pts.slice(1).forEach(p=>strokeTo(st,p[0],p[1])); },
  palDab, colorCv, get mode(){return mode;}, viewSlot, hangOnWall, doVarnish, doDry, setLight,
  settle(){ tween.t=1; camera.position.copy(tween.toP); curTarget.copy(tween.toT); camera.lookAt(curTarget); tween.active=false; handT = mode==="paint"?1:0; while(autoQueue.length) runAuto(); for(let i=0;i<3;i++) tick(performance.now()); } };

return { resume, setReference };
}
})();
