const DEFAULT_PROJECT = {
  name: 'Untitled Rocket',
  parts: [],
  weather: {temperature: 20, wind: 3, pressure: 1013, humidity: 45, launchAngle: 90},
  analysis: null
};

function getProject(){
  try { return {...DEFAULT_PROJECT, ...JSON.parse(localStorage.getItem('nimsaProject') || '{}')}; }
  catch { return {...DEFAULT_PROJECT}; }
}
function saveProject(p){ localStorage.setItem('nimsaProject', JSON.stringify(p)); }
function fmt(n,d=1){ return Number(n||0).toFixed(d); }

function initDesigner(){
  const canvas = document.querySelector('#designCanvas');
  if(!canvas) return;
  const project = getProject();
  const modal = document.querySelector('#partModal');
  const form = document.querySelector('#partForm');
  let editingIndex = null;
  document.querySelectorAll('.part').forEach(el=>{
    el.draggable = true;
    el.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',el.dataset.type));
  });
  canvas.addEventListener('dragover',e=>{e.preventDefault();canvas.classList.add('dragover')});
  canvas.addEventListener('dragleave',()=>canvas.classList.remove('dragover'));
  canvas.addEventListener('drop',e=>{e.preventDefault();canvas.classList.remove('dragover');openPartModal(e.dataTransfer.getData('text/plain'))});
  document.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',()=>openPartModal(btn.dataset.add)));
  document.querySelector('#closeModal').addEventListener('click',()=>modal.classList.remove('open'));
  modal.addEventListener('click',e=>{if(e.target===modal) modal.classList.remove('open')});
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const fd = new FormData(form);
    const part = Object.fromEntries(fd.entries());
    part.mass = +part.mass || 0;
    part.length = +part.length || 0;
    part.diameter = +part.diameter || 0;
    part.quantity = +part.quantity || 1;
    if(editingIndex===null) project.parts.push(part); else project.parts[editingIndex]=part;
    editingIndex=null; saveProject(project); render(); modal.classList.remove('open');
  });
  document.querySelector('#cadInput').addEventListener('change',e=>{
    const f=e.target.files[0]; if(!f) return;
    project.cadFile = {name:f.name,size:f.size,type:f.type||'CAD file'};
    saveProject(project); render();
  });
  document.querySelector('#clearDesign').addEventListener('click',()=>{project.parts=[];delete project.cadFile;saveProject(project);render()});
  function openPartModal(type,index=null){
    editingIndex=index;
    const existing=index!==null?project.parts[index]:null;
    form.reset();
    form.elements.type.value=type;
    form.elements.label.value=existing?.label || type.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    form.elements.material.value=existing?.material || 'Cardboard';
    form.elements.mass.value=existing?.mass || '';
    form.elements.length.value=existing?.length || '';
    form.elements.diameter.value=existing?.diameter || '';
    form.elements.quantity.value=existing?.quantity || (type==='fin-set'?3:1);
    document.querySelector('#modalTitle').textContent=(existing?'Edit ':'Add ') + form.elements.label.value;
    modal.classList.add('open');
  }
  function render(){
    canvas.querySelectorAll('.placed-part').forEach(x=>x.remove());
    document.querySelector('#canvasHint').classList.toggle('hidden',project.parts.length>0);
    project.parts.forEach((p,i)=>{
      const el=document.createElement('div');el.className='placed-part';el.style.top=(30+i*72)+'px';
      el.innerHTML=`<div>${p.label}<br><span>${p.material} · ${p.mass||0} g</span></div><button type="button">Edit</button>`;
      el.querySelector('button').onclick=()=>openPartModal(p.type,i);canvas.appendChild(el);
    });
    const mass=project.parts.reduce((a,p)=>a+(+p.mass||0)*(+p.quantity||1),0);
    const len=project.parts.reduce((a,p)=>a+(+p.length||0),0);
    document.querySelector('#partCount').textContent=project.parts.length;
    document.querySelector('#massTotal').textContent=fmt(mass,0)+' g';
    document.querySelector('#lengthTotal').textContent=fmt(len,0)+' mm';
    document.querySelector('#cadStatus').textContent=project.cadFile?project.cadFile.name:'None';
  }
  render();
}

function initConditions(){
  const form=document.querySelector('#weatherForm'); if(!form)return;
  const p=getProject(); Object.entries(p.weather||{}).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v});
  form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form);p.weather={};for(const[k,v]of fd.entries())p.weather[k]=+v;saveProject(p);location.href='analysis.html'});
}

function simulate(project){
  const parts=project.parts||[];
  const totalMassG=Math.max(120,parts.reduce((a,p)=>a+(+p.mass||0)*(+p.quantity||1),0));
  const mass=totalMassG/1000;
  const motor=parts.find(p=>p.type==='motor');
  const impulse=Math.max(12,+motor?.length/8 || 22);
  const burn=Math.max(.8, Math.min(2.8, impulse/18));
  const avgThrust=impulse/burn;
  const g=9.81;
  const Cd=.55;
  const dia=Math.max(.03,(Math.max(...parts.map(p=>+p.diameter||0),40))/1000);
  const area=Math.PI*(dia/2)**2;
  const rho=1.225*(1013/(project.weather?.pressure||1013))*(293.15/(273.15+(project.weather?.temperature||20)));
  let t=0,dt=.05,x=0,v=0,maxV=0,maxA=0; const rows=[];
  while(t<35){
    const thrust=t<=burn?avgThrust:0;
    const drag=.5*rho*Cd*area*v*Math.abs(v);
    const a=(thrust-mass*g-drag)/mass;
    v+=a*dt; x+=v*dt; if(x<0&&t>burn){x=0;v=0}
    maxV=Math.max(maxV,v);maxA=Math.max(maxA,a);
    rows.push({t,x:Math.max(0,x),v,a,thrust});
    t+=dt;if(t>burn+1&&x<=0)break;
  }
  const apogee=Math.max(...rows.map(r=>r.x));
  const flight=rows.at(-1)?.t||0;
  const wind=project.weather?.wind||0;
  const drift=wind*Math.max(0,flight-burn)*.35;
  return {rows,apogee,maxV,maxA,burn,avgThrust,flight,drift,mass,totalMassG};
}

function drawChart(canvas,rows,key,label){
  const dpr=window.devicePixelRatio||1; const w=canvas.clientWidth,h=canvas.clientHeight;
  canvas.width=w*dpr;canvas.height=h*dpr; const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,w,h);
  const pad={l:48,r:18,t:14,b:34}; const vals=rows.map(r=>r[key]); const maxT=Math.max(...rows.map(r=>r.t),1); let min=Math.min(...vals),max=Math.max(...vals); if(min===max){min-=1;max+=1}
  c.strokeStyle='#e2ddd6';c.lineWidth=1;c.beginPath();for(let i=0;i<5;i++){const y=pad.t+(h-pad.t-pad.b)*i/4;c.moveTo(pad.l,y);c.lineTo(w-pad.r,y)}c.stroke();
  c.strokeStyle='#111';c.lineWidth=2.4;c.beginPath();rows.forEach((r,i)=>{const x=pad.l+(w-pad.l-pad.r)*(r.t/maxT);const y=pad.t+(h-pad.t-pad.b)*(1-(r[key]-min)/(max-min));i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke();
  const grad=c.createLinearGradient(pad.l,0,w-pad.r,0);grad.addColorStop(0,'#ff2d7a');grad.addColorStop(.55,'#ff6a00');grad.addColorStop(1,'#ffd600');c.strokeStyle=grad;c.lineWidth=4;c.stroke();
  c.fillStyle='#68636a';c.font='12px system-ui';c.fillText('0 s',pad.l,h-12);c.fillText(maxT.toFixed(1)+' s',w-pad.r-42,h-12);c.save();c.translate(14,h/2);c.rotate(-Math.PI/2);c.fillText(label,0,0);c.restore();
}

function initAnalysis(){
  if(!document.querySelector('#analysisPage'))return; const p=getProject();
  if(!(p.parts||[]).length){document.querySelector('#analysisPage').innerHTML='<div class="notice">No rocket design found yet. Build a rocket in the Design Studio first.</div>';return;}
  const s=simulate(p);p.analysis={generatedAt:new Date().toISOString(),summary:{apogee:s.apogee,maxV:s.maxV,burn:s.burn,flight:s.flight}};saveProject(p);
  document.querySelector('#apogee').textContent=fmt(s.apogee,0)+' m';document.querySelector('#velocity').textContent=fmt(s.maxV,1)+' m/s';document.querySelector('#burnout').textContent=fmt(s.burn,2)+' s';document.querySelector('#flightTime').textContent=fmt(s.flight,1)+' s';
  drawChart(document.querySelector('#positionChart'),s.rows,'x','Position (m)');drawChart(document.querySelector('#velocityChart'),s.rows,'v','Velocity (m/s)');drawChart(document.querySelector('#accelChart'),s.rows,'a','Acceleration (m/s²)');drawChart(document.querySelector('#thrustChart'),s.rows,'thrust','Thrust (N)');
  const notes=[]; if((p.weather?.wind||0)>8)notes.push('Wind is high; consider delaying launch or using a larger field.');else notes.push('Wind input is within a moderate range for this prototype analysis.');
  if(s.avgThrust/(s.mass*9.81)<5)notes.push('Estimated thrust-to-weight ratio is low; review motor selection and total mass.');else notes.push('Estimated thrust-to-weight ratio is healthy for liftoff.');
  if(s.apogee>300)notes.push('Estimated apogee is high; verify field size, recovery setup, and local rules before launch.');
  notes.push(`Estimated wind drift: ${fmt(s.drift,0)} m using the entered weather conditions.`);
  document.querySelector('#reviewList').innerHTML=notes.map(n=>`<li>${n}</li>`).join('');
}

document.addEventListener('DOMContentLoaded',()=>{initDesigner();initConditions();initAnalysis()});
window.addEventListener('resize',()=>{if(document.querySelector('#analysisPage'))initAnalysis()});
