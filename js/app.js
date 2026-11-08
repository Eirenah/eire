'use strict';
let DATA=null, modalId=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const euros=n=>`€${Number(n).toLocaleString('en-IE')}`;
const amount=u=>u.show_price&&u.public_price_eur!=null?euros(u.public_price_eur):'Price on request';
function selected(){
 const q=$('#search').value.trim().toLowerCase(),brand=$('#filter-brand').value,region=$('#filter-region').value;
 let units=DATA.items.filter(u=>(!brand||u.brand===brand)&&(!region||u.region===region)&&(!q||[u.name,u.unit_bottle_number,u.unit_cask_number,u.cask,u.features].join(' ').toLowerCase().includes(q)));
 const sort=$('#sort').value;
 if(sort==='name')units.sort((a,b)=>a.name.localeCompare(b.name));
 else if(sort==='brand')units.sort((a,b)=>String(a.brand).localeCompare(String(b.brand))||a.stock_order-b.stock_order);
 else if(sort==='price-asc')units.sort((a,b)=>(a.public_price_eur??Infinity)-(b.public_price_eur??Infinity));
 else if(sort==='price-desc')units.sort((a,b)=>(b.public_price_eur??-1)-(a.public_price_eur??-1));
 else if(sort==='year-asc'||sort==='year-desc')units.sort((a,b)=>((a.vintage||a.age||0)-(b.vintage||b.age||0))*(sort==='year-desc'?-1:1));
 else units.sort((a,b)=>a.stock_order-b.stock_order);
 return units;
}
function render(){
 const units=selected(), grouped=$('#view-mode').value==='expressions';
 const map=new Map();
 for(const u of units){const key=grouped?u.expression_id:u.id;if(!map.has(key))map.set(key,[]);map.get(key).push(u);}
 $('#result-count').textContent=grouped?`${units.length} units · ${map.size} expressions`:`${units.length} units`;
 $('#grid').innerHTML=[...map.values()].map(group=>{
  const u=group[0], photo=u.photos[0];
  let price=amount(u);
  if(grouped){const visible=group.filter(v=>v.show_price&&v.public_price_eur!=null),values=visible.map(v=>v.public_price_eur);if(visible.length===group.length&&values.length){const lo=Math.min(...values),hi=Math.max(...values);price=lo===hi?`${euros(lo)} each`:`${euros(lo)}–${euros(hi)} each`;}else price='Price on request';}
  const serial=u.unit_bottle_number?` · Bottle ${esc(u.unit_bottle_number)}`:'';
  return `<article class="card" data-id="${esc(u.id)}" tabindex="0" role="button" aria-label="View ${esc(u.name)}"><div class="imgwrap"><img src="${esc(photo.thumb)}" alt="${esc(u.name)}" loading="lazy">${grouped?`<span class="quantity-badge">Qty ${group.length}</span>`:''}</div><div class="body"><div class="brand">${esc(u.brand)}</div><h3>${esc(u.expression_name)}</h3><div class="meta">${grouped?`${group.length} separate stock units`:(u.expression_quantity>1?`Bottle ${esc(u.unit_index)} of ${esc(u.expression_quantity)}`:'')+serial}</div><div class="meta">${esc(u.region)}${u.age?' · '+esc(u.age)+' years':''}</div><div class="price"><span class="ask">${esc(price)}</span></div>${u.uncertain?'<div class="meta">Label details under review</div>':''}</div></article>`;
 }).join('')||'<p class="empty">No units match.</p>';
 $$('#grid .card').forEach(c=>{c.onclick=()=>openModal(c.dataset.id);c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openModal(c.dataset.id);}};});
}
function openModal(id){
 const u=DATA.items.find(x=>x.id===id);if(!u)return;modalId=id;
 $('#m-brand').textContent=u.brand||'';$('#m-name').textContent=u.expression_name;
 $('#m-main').src=u.photos[0].full;$('#m-main').alt=u.name;
 const siblings=DATA.items.filter(x=>x.expression_id===u.expression_id);
 $('#m-thumbs').innerHTML=siblings.map(x=>`<button type="button" data-unit="${esc(x.id)}" class="unit-choice ${x.id===id?'active':''}"> ${esc(x.unit_index)}${x.unit_bottle_number?'<br>#'+esc(x.unit_bottle_number):''}</button>`).join('');
 $$('#m-thumbs [data-unit]').forEach(b=>b.onclick=()=>openModal(b.dataset.unit));
 $('#m-price').innerHTML=`<div class="ask-lg">${esc(amount(u))}</div>`;
 $('#m-market').innerHTML='';
 const rows=[['Bottles in collection',u.expression_quantity],['Bottle number',u.unit_bottle_number],['Unit cask number',u.unit_cask_number],['Region',u.region],['Age',u.age?u.age+' years':null],['Vintage',u.vintage],['ABV',u.abv!=null?u.abv+'%':null],['Volume',u.volume_ml?u.volume_ml+' ml':null],['Cask',u.cask]].filter(([,v])=>v!=null&&v!=='');
 $('#m-dl').innerHTML=rows.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
 $('#m-features').textContent=u.features||'';$('#m-history').textContent=u.history||'';$('#m-why').textContent=u.why_valuable||'';
 $('#m-notes').textContent=u.uncertain?'Some label details remain uncertain.':'';
 if(!$('#modal').classList.contains('open'))history.pushState({modal:1},'');$('#modal').classList.add('open');document.body.style.overflow='hidden';$('.modal-card').scrollTop=0;
}
function closeModal(){if(history.state&&history.state.modal){history.back();return;}hideModal();}
function hideModal(){$('#modal').classList.remove('open');document.body.style.overflow='';modalId=null;}
async function init(){
 const res=await fetch('data.json');if(!res.ok)throw Error('Catalog data unavailable');DATA=await res.json();
 if(DATA.view!=='public'||DATA.items.length!==194)throw Error('Invalid catalog data');
 const s=DATA.stats;$('#stat-count').textContent=s.total_units;$('#stat-expressions').textContent=s.expressions_count;$('#stat-brands').textContent=s.brands;
 for(const [selector,field] of [['#filter-brand','brand'],['#filter-region','region']])for(const v of [...new Set(DATA.items.map(u=>u[field]).filter(Boolean))].sort()){const o=document.createElement('option');o.value=v;o.textContent=v;$(selector).appendChild(o);}
 for(const selector of ['#search','#filter-brand','#filter-region','#sort','#view-mode']){$(selector).oninput=render;$(selector).onchange=render;}
 $('#modal-close').onclick=closeModal;$('#modal').onclick=e=>{if(e.target.id==='modal')closeModal();};document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});window.addEventListener('popstate',()=>{if($('#modal').classList.contains('open'))hideModal();});const ft=$('#filters-toggle');if(ft)ft.onclick=()=>$('.toolbar').classList.toggle('show-filters');render();
 const detail=new URLSearchParams(location.search).get('unit');if(detail)openModal(detail);
}
init().catch(e=>{$('#grid').textContent='Unable to load catalog. Please serve this folder over HTTP or HTTPS.';console.error(e);});
