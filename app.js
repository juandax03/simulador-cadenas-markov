"use strict";
const $=id=>document.getElementById(id);
const colors=["#1457d9","#17745b","#e07a24","#7b4cc2","#c43c66","#008c9e","#7b6b28","#5f6b7a"];
const example={names:["Freemium","Estándar","Enterprise"],unit:"mes",horizon:12,matrix:[[.75,.20,.05],[.20,.65,.15],[.05,.15,.80]],initial:[1,0,0]};
let model=null;
function fmt(x,d=4){return Number(x).toLocaleString("es-CO",{minimumFractionDigits:d,maximumFractionDigits:d})}
function pct(x){return (x*100).toLocaleString("es-CO",{minimumFractionDigits:2,maximumFractionDigits:2})+" %"}
function identity(n){return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0))}
function multiply(a,b){return a.map((r)=>b[0].map((_,j)=>r.reduce((s,v,k)=>s+v*b[k][j],0)))}
function vecMul(v,m){return m[0].map((_,j)=>v.reduce((s,x,i)=>s+x*m[i][j],0))}
function power(m,n){let r=identity(m.length),b=m.map(x=>x.slice());while(n){if(n%2)r=multiply(r,b);b=multiply(b,b);n=Math.floor(n/2)}return r}
function maxDiff(a,b){return Math.max(...a.map((x,i)=>Math.abs(x-b[i])))}
function normalizeInput(x){return x>1+1e-9?x/100:x}
function buildInputs(data=example){
  const n=+$('stateCount').value;$('stateNames').innerHTML='';$('initialVector').innerHTML='';
  for(let i=0;i<n;i++){
    const name=data.names[i]||`Estado ${i+1}`;
    $('stateNames').insertAdjacentHTML('beforeend',`<label>Nombre del estado ${i+1}<input class="state-name" value="${name}" maxlength="35"></label>`);
    $('initialVector').insertAdjacentHTML('beforeend',`<label><span class="initial-label">${name}</span><input class="initial-input" type="number" min="0" max="100" step="0.01" value="${data.initial[i]??(i===0?1:0)}"></label>`);
  }
  const table=$('matrixTable');table.innerHTML='';
  const head=document.createElement('tr');head.innerHTML='<th>Desde / hacia</th>'+Array.from({length:n},(_,i)=>`<th class="col-name">${data.names[i]||`Estado ${i+1}`}</th>`).join('')+'<th>Suma</th>';table.appendChild(head);
  for(let i=0;i<n;i++){
    const tr=document.createElement('tr');tr.innerHTML=`<td class="row-name">${data.names[i]||`Estado ${i+1}`}</td>`+Array.from({length:n},(_,j)=>`<td><input class="matrix-input" data-r="${i}" data-c="${j}" type="number" min="0" max="100" step="0.01" value="${data.matrix[i]?.[j]??(i===j?1:0)}"></td>`).join('')+`<td class="row-sum"></td>`;table.appendChild(tr);
  }
  bindDynamic();updateValidation();
}
function bindDynamic(){
  document.querySelectorAll('.state-name').forEach((el,i)=>el.addEventListener('input',()=>{const v=el.value||`Estado ${i+1}`;document.querySelectorAll('.col-name')[i].textContent=v;document.querySelectorAll('.row-name')[i].textContent=v;document.querySelectorAll('.initial-label')[i].textContent=v}));
  document.querySelectorAll('.matrix-input,.initial-input').forEach(el=>el.addEventListener('input',updateValidation));
}
function readModel(){
  const n=+$('stateCount').value,names=[...document.querySelectorAll('.state-name')].map((e,i)=>e.value.trim()||`Estado ${i+1}`);
  const matrix=Array.from({length:n},()=>Array(n).fill(0));document.querySelectorAll('.matrix-input').forEach(e=>matrix[+e.dataset.r][+e.dataset.c]=normalizeInput(+e.value));
  const initial=[...document.querySelectorAll('.initial-input')].map(e=>normalizeInput(+e.value));
  return{n,names,matrix,initial,horizon:Math.round(+$('horizon').value),unit:$('timeUnit').value.trim()||'periodo'};
}
function validate(m){const errors=[];if(!Number.isFinite(m.horizon)||m.horizon<1||m.horizon>500)errors.push('El horizonte debe ser un entero entre 1 y 500.');m.matrix.forEach((r,i)=>{if(r.some(x=>!Number.isFinite(x)||x<0||x>1))errors.push(`La fila ${i+1} contiene una probabilidad inválida.`);if(Math.abs(r.reduce((a,b)=>a+b,0)-1)>1e-7)errors.push(`La fila “${m.names[i]}” no suma 1 (suma ${fmt(r.reduce((a,b)=>a+b,0),4)}).`)});if(m.initial.some(x=>!Number.isFinite(x)||x<0||x>1))errors.push('La distribución inicial contiene un valor inválido.');if(Math.abs(m.initial.reduce((a,b)=>a+b,0)-1)>1e-7)errors.push(`La distribución inicial debe sumar 1 (suma ${fmt(m.initial.reduce((a,b)=>a+b,0),4)}).`);return errors}
function updateValidation(){
  const m=readModel();document.querySelectorAll('.row-sum').forEach((e,i)=>{const s=m.matrix[i].reduce((a,b)=>a+b,0);e.textContent=fmt(s,2);e.className='row-sum '+(Math.abs(s-1)<1e-7?'sum-ok':'sum-bad')});
  const rowOK=m.matrix.every(r=>Math.abs(r.reduce((a,b)=>a+b,0)-1)<1e-7);$('matrixStatus').textContent=rowOK?'✓ Todas las filas suman 1. La matriz es estocástica.':'Revisa las filas marcadas: cada una debe sumar 1 o 100 %.';$('matrixStatus').className='status '+(rowOK?'ok':'bad');
}
function reachability(m){const n=m.length,r=m.map(row=>row.map(x=>x>1e-12));for(let k=0;k<n;k++)for(let i=0;i<n;i++)for(let j=0;j<n;j++)r[i][j]=r[i][j]||(r[i][k]&&r[k][j]);return r}
function gcd(a,b){while(b)[a,b]=[b,a%b];return a}
function periods(m){
  const n=m.length,ret=[];for(let s=0;s<n;s++){let v=identity(n),lengths=[];for(let k=1;k<=Math.max(40,n*n*4);k++){v=multiply(v,m);if(v[s][s]>1e-11)lengths.push(k)}ret.push(lengths.reduce((g,x)=>gcd(g,x),0)||0)}return ret;
}
function classify(m){
  const n=m.length,reach=reachability(m),irreducible=reach.every(r=>r.every(Boolean)),absorbing=[];for(let i=0;i<n;i++)if(Math.abs(m[i][i]-1)<1e-10&&m[i].every((x,j)=>j===i||Math.abs(x)<1e-10))absorbing.push(i);
  const ps=periods(m),aperiodic=ps.every(p=>p===1);return{irreducible,absorbing,periods:ps,aperiodic,ergodic:irreducible&&aperiodic};
}
function stationary(m){let v=Array(m.length).fill(1/m.length);for(let k=0;k<100000;k++){const nv=vecMul(v,m);if(maxDiff(v,nv)<1e-13)return{vector:nv,iterations:k+1};v=nv}return{vector:v,iterations:100000}}
function convergence(m,pi){let p=identity(m.length);for(let k=1;k<=10000;k++){p=multiply(p,m);if(Math.max(...p.map(r=>maxDiff(r,pi)))<1e-4)return k}return null}
function renderBars(id,names,values){$(id).innerHTML=values.map((v,i)=>`<div class="bar-row"><span>${names[i]}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,Math.min(100,v*100))}%;background:${colors[i]}"></div></div><strong>${pct(v)}</strong></div>`).join('')}
function tableHTML(names,m){return'<tr><th>Desde / hacia</th>'+names.map(x=>`<th>${x}</th>`).join('')+'</tr>'+m.map((r,i)=>`<tr><td>${names[i]}</td>${r.map(x=>`<td>${fmt(x,4)}</td>`).join('')}</tr>`).join('')}
function drawChart(canvas,names,series){
  const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,p={l:70,r:25,t:20,b:48};ctx.clearRect(0,0,W,H);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#dfe4ec';ctx.lineWidth=1;ctx.font='22px system-ui';ctx.fillStyle='#667085';ctx.textAlign='right';
  for(let y=0;y<=4;y++){const yy=p.t+(H-p.t-p.b)*y/4;ctx.beginPath();ctx.moveTo(p.l,yy);ctx.lineTo(W-p.r,yy);ctx.stroke();ctx.fillText(`${100-y*25}%`,p.l-10,yy+7)}
  const steps=series.length-1,maxTicks=Math.min(10,steps);ctx.textAlign='center';for(let i=0;i<=maxTicks;i++){const k=Math.round(steps*i/maxTicks),x=p.l+(W-p.l-p.r)*k/steps;ctx.fillText(k,x,H-15)}
  names.forEach((_,j)=>{ctx.strokeStyle=colors[j];ctx.lineWidth=4;ctx.beginPath();series.forEach((v,k)=>{const x=p.l+(W-p.l-p.r)*k/steps,y=p.t+(H-p.t-p.b)*(1-v[j]);k?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()});
}
function calculate(){
  const m=readModel(),errors=validate(m);$('errorBox').hidden=!errors.length;$('errorBox').innerHTML=errors.map(e=>`<div>• ${e}</div>`).join('');if(errors.length){$('results').hidden=true;return}
  const pn=power(m.matrix,m.horizon),proj=vecMul(m.initial,pn),st=stationary(m.matrix),cls=classify(m.matrix),conv=cls.ergodic?convergence(m.matrix,st.vector):null;
  const series=[m.initial],maxChart=Math.min(m.horizon,100);for(let k=1;k<=maxChart;k++)series.push(vecMul(series[k-1],m.matrix));model={...m,pn,proj,pi:st.vector,cls,conv,series};
  $('results').hidden=false;$('exportBtn').disabled=false;$('resultSummary').textContent=`Cálculo realizado con ${m.n} estados y horizonte de ${m.horizon} ${m.unit}${m.horizon===1?'':'es'}.`;
  $('chainType').textContent=cls.ergodic?'Ergódica':cls.absorbing.length?'Absorbente':'No ergódica';$('chainDetail').textContent=cls.ergodic?'Irreducible y aperiódica':cls.absorbing.length?`${cls.absorbing.length} estado(s) absorbente(s)`:'Puede tener clases o periodicidad';$('horizonMetric').textContent=`${m.horizon} ${m.unit}${m.horizon===1?'':'es'}`;$('convergenceMetric').textContent=conv?`≈ ${conv} ${m.unit}${conv===1?'':'es'}`:'No aplica';
  renderBars('projectionBars',m.names,proj);renderBars('stationaryBars',m.names,st.vector);$('projectionFormula').innerHTML=`v<sub>${m.horizon}</sub> = v<sub>0</sub> · P<sup>${m.horizon}</sup>`;$('stationaryNote').textContent=cls.ergodic?'La distribución es única e independiente del estado inicial.':'Vector estacionario numérico de referencia; en una cadena no ergódica puede depender de la clase o del estado inicial.';
  $('powerLabel').textContent=`n = ${m.horizon}`;$('powerTable').innerHTML=tableHTML(m.names,pn);$('chartLegend').innerHTML=m.names.map((n,i)=>`<span><i class="dot" style="background:${colors[i]}"></i>${n}</span>`).join('');drawChart($('evolutionChart'),m.names,series);
  const top=st.vector.indexOf(Math.max(...st.vector));$('interpretation').textContent=cls.ergodic?`En el largo plazo, la mayor participación corresponde a ${m.names[top]} con ${pct(st.vector[top])}. La distribución proyectada al periodo ${m.horizon} es ${m.names.map((n,i)=>`${n}: ${pct(proj[i])}`).join(', ')}. Como la cadena es ergódica, el efecto de la distribución inicial desaparece gradualmente.`:`La proyección al periodo ${m.horizon} es ${m.names.map((n,i)=>`${n}: ${pct(proj[i])}`).join(', ')}. La cadena no cumple simultáneamente irreducibilidad y aperiodicidad, por lo que no se debe afirmar que existe un único equilibrio independiente del punto de inicio.`;
  const double=m.matrix.every((_,j)=>Math.abs(m.matrix.reduce((s,r)=>s+r[j],0)-1)<1e-7);$('diagnostics').innerHTML=[`La matriz es estocástica: todas las filas suman 1.`,double?'También es doblemente estocástica: todas las columnas suman 1.':'No es doblemente estocástica; las columnas no necesariamente suman 1.',cls.irreducible?'Todos los estados se comunican entre sí.':'No todos los estados se comunican entre sí.',cls.aperiodic?'Los estados son aperiódicos (periodo 1).':`Periodos detectados: ${cls.periods.join(', ')}.`,cls.absorbing.length?`Estados absorbentes: ${cls.absorbing.map(i=>m.names[i]).join(', ')}.`:'No se detectaron estados absorbentes.'].map(x=>`<li>${x}</li>`).join('');$('results').scrollIntoView({behavior:'smooth',block:'start'});
}
function exportCSV(){if(!model)return;const m=model,rows=[["Laboratorio de Cadenas de Markov"],["Horizonte",m.horizon,m.unit],["Tipo",m.cls.ergodic?"Ergódica":m.cls.absorbing.length?"Absorbente":"No ergódica"],[],["Estado","Inicial","Proyección","Largo plazo"],...m.names.map((n,i)=>[n,m.initial[i],m.proj[i],m.pi[i]]),[],[`Matriz P^${m.horizon}`],["Desde / hacia",...m.names],...m.pn.map((r,i)=>[m.names[i],...r])];const csv=rows.map(r=>r.map(x=>`"${String(x??'').replaceAll('"','""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download='resultados_markov.csv';a.click();URL.revokeObjectURL(a.href)}
$('stateCount').addEventListener('change',()=>buildInputs({names:[],matrix:[],initial:[]}));$('exampleBtn').addEventListener('click',()=>{$('stateCount').value=3;$('timeUnit').value=example.unit;$('horizon').value=example.horizon;buildInputs(example);$('results').hidden=true});$('calculateBtn').addEventListener('click',calculate);$('exportBtn').addEventListener('click',exportCSV);buildInputs(example);
