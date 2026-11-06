let DATA = null;
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

async function init(){
  const res = await fetch('data.json');
  DATA = await res.json();
  if(DATA.view !== 'public') console.warn('Expected public data.json');
  renderStats();
  fillFilters();
  bind();
  render();
}

function renderStats(){
  const s = DATA.stats || {};
  $('#stat-count').textContent = s.unique_bottles ?? DATA.items.length;
  $('#stat-brands').textContent = s.brands ?? new Set(DATA.items.map(i=>i.brand)).size;
  const priced = DATA.items.filter(i => i.show_price && i.public_price_eur != null);
  if($('#stat-priced')) $('#stat-priced').textContent = priced.length;
  if($('#stat-total')) {
    // Hide legacy total stat if present
    const wrap = $('#stat-total')?.closest('.stat');
    if(wrap) wrap.style.display = 'none';
  }
  if($('#stat-market')) {
    const est = s.est_market_value_eur || priced.reduce((a,b)=>a+(b.public_price_eur||0),0);
    $('#stat-market').textContent = est ? `€${est.toLocaleString('en-IE')}` : '—';
  }
}

function fillFilters(){
  const brands = [...new Set(DATA.items.map(i=>i.brand).filter(Boolean))].sort();
  const regions = [...new Set(DATA.items.map(i=>i.region).filter(Boolean))].sort();
  const bsel = $('#filter-brand');
  const rsel = $('#filter-region');
  brands.forEach(b=>{ const o=document.createElement('option'); o.value=b; o.textContent=b; bsel.appendChild(o); });
  regions.forEach(r=>{ const o=document.createElement('option'); o.value=r; o.textContent=r; rsel.appendChild(o); });
}

function bind(){
  ['#search','#filter-brand','#filter-region','#sort'].forEach(sel=>{
    $(sel).addEventListener('input', render);
    $(sel).addEventListener('change', render);
  });
  $('#modal').addEventListener('click', e=>{ if(e.target.id==='modal') closeModal(); });
  $('#modal-close').addEventListener('click', closeModal);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
}

function filtered(){
  const q = $('#search').value.trim().toLowerCase();
  const brand = $('#filter-brand').value;
  const region = $('#filter-region').value;
  const sort = $('#sort').value;
  let list = DATA.items.filter(it=>{
    if(brand && it.brand!==brand) return false;
    if(region && it.region!==region) return false;
    if(!q) return true;
    const blob = `${it.name} ${it.brand} ${it.region} ${it.features||''} ${it.history||''}`.toLowerCase();
    return blob.includes(q);
  });
  list = [...list];
  if(sort==='price-asc') list.sort((a,b)=>(a.public_price_eur??1e12)-(b.public_price_eur??1e12));
  if(sort==='price-desc') list.sort((a,b)=>(b.public_price_eur??-1)-(a.public_price_eur??-1));
  if(sort==='year-asc') list.sort((a,b)=>(a.vintage||a.age||0)-(b.vintage||b.age||0));
  if(sort==='year-desc') list.sort((a,b)=>(b.vintage||b.age||0)-(a.vintage||a.age||0));
  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name));
  if(sort==='brand') list.sort((a,b)=>a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name));
  return list;
}

function render(){
  const list = filtered();
  const grid = $('#grid');
  $('#result-count').textContent = `${list.length} bottle${list.length===1?'':'s'}`;
  if(!list.length){ grid.innerHTML = `<div class="empty">No bottles match.</div>`; return; }
  grid.innerHTML = list.map(it=>{
    const img = (it.photos&&it.photos[0]) ? it.photos[0].thumb : '';
    const age = it.age ? `${it.age} Year Old` : (it.vintage ? String(it.vintage) : '');
    const price = (it.show_price && it.public_price_eur!=null)
      ? `<span class="ask">€${Number(it.public_price_eur).toLocaleString('en-IE')}</span>`
      : `<span class="tbd">Price on request</span>`;
    return `<article class="card" data-id="${it.id}">
      <div class="imgwrap">${img?`<img src="${img}" alt="${escapeHtml(it.name)}" loading="lazy">`:''}</div>
      <div class="body">
        <div class="brand">${escapeHtml(it.brand||'')}</div>
        <h3>${escapeHtml(it.name)}</h3>
        <div class="meta">${[it.region, age].filter(Boolean).map(escapeHtml).join(' · ')}</div>
        <div class="price">${price}</div>
      </div>
    </article>`;
  }).join('');
  $$('.card').forEach(c=>c.addEventListener('click',()=>openModal(c.dataset.id)));
}

function openModal(id){
  const it = DATA.items.find(x=>x.id===id);
  if(!it) return;
  const photos = it.photos||[];
  const main = photos[0]?.full || photos[0]?.thumb || '';
  $('#m-brand').textContent = it.brand||'';
  $('#m-name').textContent = it.name;
  const priceHtml = (it.show_price && it.public_price_eur!=null)
    ? `<div class="ask-lg">€${Number(it.public_price_eur).toLocaleString('en-IE')}</div>`
    : `<span class="tbd">Price on request</span>`;
  $('#m-price').innerHTML = priceHtml;
  const mkt = $('#m-market');
  if(mkt) mkt.innerHTML = ''; // market/auction reserved for owner view
  $('#m-main').src = main;
  $('#m-main').alt = it.name;
  $('#m-thumbs').innerHTML = photos.map((p,i)=>`<img src="${p.thumb}" data-full="${p.full}" class="${i===0?'active':''}" alt="">`).join('');
  $$('#m-thumbs img').forEach(img=>img.addEventListener('click',()=>{
    $('#m-main').src = img.dataset.full;
    $$('#m-thumbs img').forEach(x=>x.classList.remove('active'));
    img.classList.add('active');
  }));
  const rows = [
    ['Region', it.region],
    ['Age', it.age?`${it.age} years`:null],
    ['Vintage', it.vintage],
    ['ABV', it.abv!=null?`${it.abv}%`:null],
    ['Volume', it.volume_ml?`${it.volume_ml} ml`:null],
    ['Cask / No.', it.cask],
  ].filter(([,v])=>v!=null && v!=='');
  $('#m-dl').innerHTML = rows.map(([k,v])=>`<dt>${escapeHtml(String(k))}</dt><dd>${escapeHtml(String(v))}</dd>`).join('');
  $('#m-features').textContent = it.features||'';
  $('#m-history').textContent = it.history||'';
  if($('#m-why')) $('#m-why').textContent = it.why_valuable||'';
  if($('#m-notes')) $('#m-notes').textContent = '';
  $('#modal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeModal(){
  $('#modal').classList.remove('open');
  document.body.style.overflow='';
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
init();
