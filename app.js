/* Mallorca Survival 2027 · mdnss — lógica de la app */
'use strict';

// ---------- configuración ----------
const STRIPE_LINK = '';          // Payment Link de Stripe
const PRICE = '';                // p. ej. '215 €'
const PLAZAS = 30;
const SB_URL = 'https://abngtrlvozeepztsixrv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmd0cmx2b3plZXB6dHNpeHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjcwODQsImV4cCI6MjA5NjEwMzA4NH0.oVIrLLfV8kVEijCnjeuZC9Ox5do5Cywilbpm_EFuvMY';
const JERSEY_FRAMES = 8;

const VIEWS = [['inicio','Inicio'],['ruta','Ruta'],['horarios','Horarios'],['ferry','Ferry'],['apoyo','Apoyo'],['maillot','Maillot'],['inscripcion','Inscripción']];
const START = 6*60+30, STOPMIN = 18, K = 10, SPEED = {A:30, B:27};
const STOPS = ['Sóller','Port de Pollença','Artà','Santanyí'];
const LABELS = ['Palma · salida','Andratx','Sóller','Puig Major (túnel)','Pollença','Alcúdia','Artà','Porto Cristo','Santanyí'];

const $ = id => document.getElementById(id);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = (x, d = 0) => { const p = x.toFixed(d).split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return p.join(','); };
const hhmm = m => { m = Math.round(m); return String(Math.floor(m/60)%24).padStart(2,'0') + ':' + String(((m%60)+60)%60).padStart(2,'0'); };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- navegación ----------
let current = -1;
let onView = () => {};
const head = $('head'), menu = $('menu');
$('menuList').innerHTML = VIEWS.map((v,i) => '<li><a href="#'+v[0]+'"><span>0'+(i+1)+'</span>'+v[1]+'</a></li>').join('');

function openMenu(open){
  menu.classList.toggle('open', open);
  $('menuBtn').setAttribute('aria-expanded', open);
  document.documentElement.style.overflow = open ? 'hidden' : '';
  if (open) $('closeBtn').focus();
}
$('menuBtn').addEventListener('click', () => openMenu(true));
$('closeBtn').addEventListener('click', () => { openMenu(false); $('menuBtn').focus(); });
menu.addEventListener('click', e => { if (e.target.closest('a')) openMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) { openMenu(false); $('menuBtn').focus(); } });

function show(i, dir){
  if (i === current || i < 0 || i >= VIEWS.length) return;
  const prev = current; current = i;
  document.querySelectorAll('.view').forEach((v,k) => { v.classList.toggle('on', k === i); v.classList.remove('enter-l','enter-r'); });
  const view = $(VIEWS[i][0]);
  if (prev >= 0 && !reduce) { void view.offsetWidth; view.classList.add((dir ?? (i > prev ? 1 : -1)) > 0 ? 'enter-r' : 'enter-l'); }
  window.scrollTo(0, 0);
  $('headTitle').textContent = view.dataset.title;
  menu.querySelectorAll('a').forEach((a,k) => { if (k === i) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  document.title = (i ? VIEWS[i][1] + ' · ' : '') + 'Mallorca Survival 2027';
  onHead(); onView();
}
function fromHash(){ const i = VIEWS.findIndex(v => '#'+v[0] === location.hash); show(i < 0 ? 0 : i); }
window.addEventListener('hashchange', fromHash);
function go(i){ if (i >= 0 && i < VIEWS.length) location.hash = VIEWS[i][0]; }

// cabecera sólida al salir de la banda con el patrón
function onHead(){
  const view = $(VIEWS[Math.max(0,current)][0]);
  const band = view.querySelector('.hero, .band');
  const limit = band ? band.offsetHeight - head.offsetHeight : 0;
  head.classList.toggle('solid', window.scrollY > limit);
}
window.addEventListener('scroll', onHead, {passive:true});

// deslizar entre secciones (lejos de los bordes, para no chocar con el gesto «atrás» de Safari)
let sx = 0, sy = 0, st = 0, swipeOk = false;
const NOSWIPE = '.stage, .feed, .jersey, input, select, textarea, canvas, .range, .menu';
document.addEventListener('touchstart', e => {
  const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
  swipeOk = e.touches.length === 1 && sx > 28 && sx < innerWidth - 28 && !e.target.closest(NOSWIPE);
}, {passive:true});
document.addEventListener('touchend', e => {
  if (!swipeOk) return;
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  if (Date.now() - st < 600 && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) go(current + (dx < 0 ? 1 : -1));
}, {passive:true});

// ---------- conexión ----------
const offline = $('offline');
const net = () => offline.classList.toggle('on', !navigator.onLine);
addEventListener('online', net); addEventListener('offline', net); net();
if ('serviceWorker' in navigator && location.protocol === 'https:') addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// ---------- datos de la ruta ----------
fromHash();
fetch('assets/route.json').then(r => r.json()).then(boot).catch(() => { $('fDist').textContent = '301,6 km'; });

function boot(DATA){
  const T = DATA.trk, N = T.d.length, D = T.d[N-1];
  const wp = n => DATA.wps.find(w => w.n === n);
  const stopIdx = STOPS.map(n => wp(n).i);
  const effort = i => T.d[i] + K*T.g[i]/1000, ETOT = effort(N-1);
  const timeAt = (i, g) => START + (D/SPEED[g]*60) * effort(i)/ETOT + STOPMIN * stopIdx.filter(s => s < i).length;
  const idxAtKm = km => { let lo = 0, hi = N-1; while (lo < hi){ const m = (lo+hi) >> 1; if (T.d[m] < km) lo = m+1; else hi = m; } return lo; };
  const maps = i => 'https://maps.apple.com/?q=' + T.lat[i] + ',' + T.lon[i];
  let group = 'A', cur = wp('Puig Major (túnel)').i;

  // inicio
  $('fDist').innerHTML = fmt(D,1) + '<small>km</small>';
  $('fGain').innerHTML = fmt(Math.round(DATA.gain/10)*10) + '<small>m+</small>';
  $('fMax').innerHTML = fmt(DATA.maxele) + '<small>m</small>';
  $('profMax').textContent = 'Máx. ' + fmt(DATA.maxele) + ' m · ' + fmt(Math.round(DATA.gain/10)*10) + ' m+';
  const DEP = Date.UTC(2027,3,9,20,30);
  const tick = () => {
    const s = Math.floor((DEP - Date.now())/1000);
    if (s <= 0) { $('count').textContent = 'En marcha'; return; }
    const d = Math.floor(s/86400), h = Math.floor(s%86400/3600), m = Math.floor(s%3600/60);
    $('count').textContent = d + ' d · ' + h + ' h · ' + m + ' min';
  };
  tick(); setInterval(tick, 30000);

  // horarios
  function renderTimes(){
    $('gA').setAttribute('aria-pressed', group === 'A'); $('gB').setAttribute('aria-pressed', group === 'B');
    $('stops').innerHTML = STOPS.map((n,k) => { const w = wp(n), t = timeAt(w.i, group);
      return '<article><span class="n">Parada '+(k+1)+' · km '+fmt(w.km,1)+'</span><span class="t">'+hhmm(t)+'</span><span class="p">'+n+'</span><span class="m">Salida '+hhmm(t+STOPMIN)+'</span><a href="'+maps(w.i)+'" target="_blank" rel="noopener">Abrir en Mapas</a></article>'; }).join('');
    $('rows').innerHTML = DATA.wps.map(w => { const s = STOPS.includes(w.n), c = w.n === 'Alcúdia';
      return '<li class="'+(s?'stop':'')+'" data-i="'+w.i+'"><b>'+hhmm(timeAt(w.i, group))+'</b><span class="place">'+esc(w.n)+(s?'<span class="tag">Parada</span>':'')+(c?'<span class="tag cut">Corte 13:30</span>':'')+'</span><span class="meta">km '+fmt(w.km,1)+'<br>'+fmt(w.ele)+' m</span></li>'; }).join('');
    readout();
  }
  $('gA').addEventListener('click', () => { group = 'A'; renderTimes(); });
  $('gB').addEventListener('click', () => { group = 'B'; renderTimes(); });
  $('rows').addEventListener('click', e => { const li = e.target.closest('li'); if (li){ setPos(+li.dataset.i); go(1); } });

  // apoyo
  $('van').innerHTML = STOPS.map(n => { const w = wp(n);
    return '<li><div><b>'+n+'</b><p>km '+fmt(w.km,1)+' · de '+hhmm(timeAt(w.i,'A')-20)+' a '+hhmm(timeAt(w.i,'B')+STOPMIN)+'</p></div><a class="btn small ghost" href="'+maps(w.i)+'" target="_blank" rel="noopener">Mapa</a></li>'; }).join('') +
    '<li><div><b>Palma · meta</b><p>Antes de las '+hhmm(timeAt(N-1,'A')-30)+', con las bolsas</p></div><a class="btn small ghost" href="'+maps(N-1)+'" target="_blank" rel="noopener">Mapa</a></li>';
  const ITEMS = ['Agua y bidones de repuesto','Comida de los avituallamientos','Ruedas de repuesto y cámaras','Bomba de pie y herramientas','Botiquín','Bolsas de los participantes','Luces y chalecos para la salida','Baterías y cargadores'];
  let done = {};
  try { done = JSON.parse(localStorage.getItem('ms27-check') || '{}') || {}; } catch(e) {}
  $('check').innerHTML = ITEMS.map((t,i) => '<label><input type="checkbox" data-k="'+i+'"'+(done[i]?' checked':'')+'><span>'+t+'</span></label>').join('');
  const countDone = () => { $('checkCount').textContent = ITEMS.filter((_,i) => done[i]).length + ' de ' + ITEMS.length; };
  countDone();
  $('check').addEventListener('change', e => { done[e.target.dataset.k] = e.target.checked; countDone(); try { localStorage.setItem('ms27-check', JSON.stringify(done)); } catch(err) {} });

  // maillot: 8 vistas, arrastrar para girar
  const frames = Array.from({length:JERSEY_FRAMES}, (_,i) => 'assets/maillot/'+(i+1)+'.jpg');
  frames.forEach(src => { const im = new Image(); im.src = src; });
  let jf = 0, jx = null, jacc = 0, spun = false, spin = 0;
  $('jdots').innerHTML = frames.map(() => '<i></i>').join('');
  const setJ = i => { jf = ((i % frames.length) + frames.length) % frames.length; $('jimg').src = frames[jf]; $('jdots').querySelectorAll('i').forEach((d,k) => d.classList.toggle('on', k === jf)); };
  setJ(0);
  const turn = $('turn');
  turn.addEventListener('pointerdown', e => { jx = e.clientX; jacc = 0; turn.setPointerCapture(e.pointerId); clearInterval(spin); });
  turn.addEventListener('pointermove', e => {
    if (jx == null) return;
    jacc += e.clientX - jx; jx = e.clientX;
    $('jimg').style.transform = 'perspective(900px) rotateY(' + Math.max(-12, Math.min(12, jacc/3)) + 'deg)';
    while (jacc > 40) { jacc -= 40; setJ(jf-1); } while (jacc < -40) { jacc += 40; setJ(jf+1); }
  });
  const jUp = () => { jx = null; $('jimg').style.transform = ''; };
  turn.addEventListener('pointerup', jUp); turn.addEventListener('pointercancel', jUp);
  const spinOnce = () => { if (spun || reduce) return; spun = true; let n = 0; spin = setInterval(() => { setJ(jf+1); if (++n >= frames.length) clearInterval(spin); }, 160); };

  // inscripción y pago
  $('price').textContent = PRICE || 'Precio por confirmar';
  $('price').classList.toggle('tbc', !PRICE);
  const pay = $('pay');
  if (STRIPE_LINK) { pay.href = STRIPE_LINK; $('payNote').textContent = 'Pago seguro en Stripe. Se abre en una ventana nueva.'; }
  else { pay.setAttribute('aria-disabled','true'); pay.removeAttribute('target'); pay.addEventListener('click', e => e.preventDefault()); $('payNote').textContent = 'El pago se activa cuando se abran las inscripciones. Envía tus datos y te avisamos.'; }

  const sb = (path, opt = {}) => fetch(SB_URL + '/rest/v1/' + path, {method: opt.method || 'GET', body: opt.body ? JSON.stringify(opt.body) : undefined,
    headers: Object.assign({apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json'}, opt.headers || {})});
  const loadSeats = () => sb('rpc/survival_plazas', {method:'POST', body:{}}).then(r => r.ok ? r.json() : Promise.reject()).then(n => {
    n = +n || 0; $('seats').innerHTML = '<b>' + n + ' / ' + PLAZAS + '</b> plazas<br>' + (n >= PLAZAS ? 'lista de espera' : 'ocupadas');
  }).catch(() => {});
  const loadAvisos = () => sb('survival_avisos?select=texto,importante,created_at&order=created_at.desc&limit=6').then(r => r.ok ? r.json() : Promise.reject()).then(rows => {
    if (!rows || !rows.length) return;
    $('avisos').innerHTML = '<div class="sec"><div class="sec-h"><h3>Avisos</h3><span>Organización</span></div><ul class="opts">' +
      rows.map(a => '<li><b>' + esc(a.texto) + '</b><p>' + new Date(a.created_at).toLocaleDateString('es-ES', {day:'numeric', month:'long'}) + '</p></li>').join('') + '</ul></div>';
    const top = rows.find(a => a.importante); if (top) { $('heroAviso').textContent = top.texto; $('heroAviso').style.display = 'block'; }
  }).catch(() => {});
  loadSeats(); loadAvisos();

  $('form').addEventListener('submit', e => {
    e.preventDefault();
    const msg = $('formMsg'), v = id => $(id).value.trim();
    const say = (t, c) => { msg.textContent = t; msg.className = 'msg ' + (c || ''); };
    if (v('fNombre').length < 2) { $('fNombre').focus(); return say('Escribe tu nombre y apellidos.', 'err'); }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('fEmail'))) { $('fEmail').focus(); return say('Revisa el email: falta algo.', 'err'); }
    if (!$('fOk').checked) return say('Marca la casilla de datos para poder inscribirte.', 'err');
    $('send').disabled = true; say('Enviando…');
    sb('survival_inscripciones', {method:'POST', headers:{Prefer:'return=minimal'}, body:{nombre:v('fNombre'), email:v('fEmail'), telefono:v('fTel') || null, talla:$('fTalla').value, grupo:$('fGrupo').value, vuelta:$('fVuelta').value, comentario:v('fNota') || null, acepta_datos:true}})
      .then(r => { if (!r.ok) throw new Error(r.status); $('form').reset(); $('send').textContent = 'Inscripción enviada';
        say(STRIPE_LINK ? 'Recibido. Paga abajo para confirmar tu plaza.' : 'Recibido. Te escribimos cuando se abra el pago.', 'ok'); loadSeats(); })
      .catch(() => { $('send').disabled = false; say(navigator.onLine ? 'No se pudo enviar. Inténtalo de nuevo en un momento.' : 'Sin conexión. Inténtalo cuando vuelvas a tener cobertura.', 'err'); });
  });

  // perfil
  const pc = $('prof'), px2 = pc.getContext('2d'), PAD = {l:38, r:6, t:8, b:22}, EMAX = Math.ceil(DATA.maxele/300)*300;
  function drawProfile(){
    const dpr = devicePixelRatio || 1, w = pc.clientWidth, h = pc.clientHeight; if (!w) return;
    pc.width = Math.round(w*dpr); pc.height = Math.round(h*dpr); px2.setTransform(dpr,0,0,dpr,0,0); px2.clearRect(0,0,w,h);
    const X = km => PAD.l + km/D*(w-PAD.l-PAD.r), Y = e => h-PAD.b - Math.max(0,e)/EMAX*(h-PAD.t-PAD.b);
    px2.font = '11px ' + css('--font'); px2.textBaseline = 'middle';
    for (let e = 0; e <= EMAX; e += 300) { px2.strokeStyle = 'rgba(150,210,217,.14)'; px2.lineWidth = 1; px2.beginPath(); px2.moveTo(PAD.l,Y(e)); px2.lineTo(w-PAD.r,Y(e)); px2.stroke(); px2.fillStyle = '#7f93a9'; px2.textAlign = 'right'; px2.fillText(e, PAD.l-6, Y(e)); }
    px2.textAlign = 'center'; px2.textBaseline = 'top';
    for (let k = 0; k <= D; k += 50) px2.fillText(k, Math.min(X(k), w-10), h-PAD.b+6);
    px2.beginPath(); px2.moveTo(X(0), Y(0));
    for (let i = 0; i < N; i += 3) px2.lineTo(X(T.d[i]), Y(T.ele[i]));
    px2.lineTo(X(D), Y(0)); px2.closePath();
    const gr = px2.createLinearGradient(0, PAD.t, 0, h-PAD.b); gr.addColorStop(0,'rgba(150,210,217,.55)'); gr.addColorStop(1,'rgba(150,210,217,.06)');
    px2.fillStyle = gr; px2.fill();
    px2.beginPath(); for (let i = 0; i < N; i += 3) { const x = X(T.d[i]), y = Y(T.ele[i]); i ? px2.lineTo(x,y) : px2.moveTo(x,y); }
    px2.strokeStyle = '#96d2d9'; px2.lineWidth = 1.25; px2.stroke();
    stopIdx.forEach(i => { px2.fillStyle = '#ff9e7a'; px2.fillRect(X(T.d[i])-1, h-PAD.b-6, 2, 6); });
    const x = X(T.d[cur]), y = Y(T.ele[cur]);
    px2.strokeStyle = '#fff'; px2.lineWidth = 1; px2.beginPath(); px2.moveTo(x, PAD.t); px2.lineTo(x, h-PAD.b); px2.stroke();
    px2.fillStyle = '#ff9e7a'; px2.beginPath(); px2.arc(x, y, 5, 0, Math.PI*2); px2.fill();
  }
  function readout(){
    $('readout').innerHTML = '<div><span>Km</span><b class="hl">'+fmt(T.d[cur],1)+'</b></div><div><span>Altitud</span><b>'+fmt(T.ele[cur])+' m</b></div><div><span>Grupo A</span><b>'+hhmm(timeAt(cur,'A'))+'</b></div><div><span>Grupo B</span><b>'+hhmm(timeAt(cur,'B'))+'</b></div>';
  }
  let pdrag = false;
  const pick = e => { const r = pc.getBoundingClientRect(); stopFly(); setPos(idxAtKm(Math.min(D, Math.max(0, (e.clientX-r.left-PAD.l)/(r.width-PAD.l-PAD.r)*D)))); };
  pc.addEventListener('pointerdown', e => { pdrag = true; pc.setPointerCapture(e.pointerId); pick(e); });
  pc.addEventListener('pointermove', e => { if (pdrag) pick(e); });
  pc.addEventListener('pointerup', () => pdrag = false); pc.addEventListener('pointercancel', () => pdrag = false);
  $('km').max = D;
  $('km').addEventListener('input', e => { stopFly(); setPos(idxAtKm(+e.target.value)); });
  function setPos(i){ cur = Math.min(N-1, Math.max(0, i)); $('km').value = T.d[cur]; readout(); drawProfile(); placeMarker(); render(); }
  new ResizeObserver(drawProfile).observe(pc);

  // ---------- 3D ----------
  const LATC = 39.62, LONC = 2.89, KX = 111.32*Math.cos(LATC*Math.PI/180), KZ = 110.57, EXAG = 2.5;
  const P = lon => (lon-LONC)*KX, Z = lat => -(lat-LATC)*KZ;
  const dem = DATA.dem, raw = atob(dem.b64), bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  const grid = new Uint16Array(bytes.buffer);
  const hAt = (r,c) => { r = Math.min(dem.h-1, Math.max(0,r)); c = Math.min(dem.w-1, Math.max(0,c)); const v = grid[r*dem.w+c]; return v ? v-1 : 0; };
  const sample = (lat, lon) => { const fc = (lon-dem.west)/dem.dx-.5, fr = (dem.north-lat)/dem.dy-.5, c0 = Math.floor(fc), r0 = Math.floor(fr), tx = fc-c0, ty = fr-r0;
    return (hAt(r0,c0)*(1-tx)+hAt(r0,c0+1)*tx)*(1-ty) + (hAt(r0+1,c0)*(1-tx)+hAt(r0+1,c0+1)*tx)*ty; };
  const trackY = i => (Math.max(sample(T.lat[i], T.lon[i]), 0) + 45)/1000;

  let renderer, scene, camera, controls, world, marker, tube, ghost, tubeCount = 0, ghostCount = 0, labelEls = [], heroCorners = [], heroCenter;
  let mode = 'hero', heroA = -0.25, intro = reduce ? 1 : 0, flyT = -1, loopOn = false, last = 0, visible = true;
  let camPos, camTgt;

  function placeMarker(){ if (marker) marker.position.set(P(T.lon[cur]), trackY(cur)*world.scale.y + .9, Z(T.lat[cur])); }
  function render(){
    if (!renderer) return;
    renderer.render(scene, camera);
    if (mode !== 'route') return;
    const st = $('routeStage'), w = st.clientWidth, h = st.clientHeight, v = new THREE.Vector3();
    labelEls.forEach(L => { v.set(P(T.lon[L.i]), trackY(L.i)*world.scale.y, Z(T.lat[L.i])).project(camera);
      const on = flyT < 0 && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1; L.el.style.display = on ? '' : 'none';
      if (on) { L.el.style.left = ((v.x+1)/2*w) + 'px'; L.el.style.top = ((1-v.y)/2*h) + 'px'; } });
  }
  function fit(){
    if (!renderer) return;
    const host = renderer.domElement.parentElement, w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w/h; camera.fov = mode === 'hero' ? 34 : (w/h < 1 ? 50 : 38); camera.updateProjectionMatrix();
    if (mode === 'hero') heroCam(); render();
  }
  function heroCam(){
    if (!heroCenter) return;
    const dir = new THREE.Vector3(Math.sin(heroA), .78, Math.cos(heroA)).normalize();
    const right = new THREE.Vector3(Math.cos(heroA), 0, -Math.sin(heroA)), up = new THREE.Vector3().crossVectors(dir, right);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)), tanH = tanV*camera.aspect;
    let dist = 0;
    heroCorners.forEach(p => { const o = p.clone().sub(heroCenter), d = o.dot(dir); dist = Math.max(dist, d + Math.abs(o.dot(right))/tanH, d + Math.abs(o.dot(up))/tanV); });
    camera.position.copy(heroCenter).addScaledVector(dir, dist*1.04); camera.lookAt(heroCenter);
  }
  function homeCam(){ const k = camera.aspect < 1 ? 1.3 : 1; camera.position.set(-10*k, 92*k, 78*k); controls.target.set(0,0,3); controls.update(); }
  function flyCam(dt){
    const i = cur, j = Math.max(0, i-60), k = Math.min(N-1, i+60), mx = P(T.lon[i]), mz = Z(T.lat[i]), my = trackY(i)*EXAG;
    let dx = P(T.lon[k])-P(T.lon[j]), dz = Z(T.lat[k])-Z(T.lat[j]); const l = Math.hypot(dx,dz) || 1; dx /= l; dz /= l;
    camPos.lerp(new THREE.Vector3(mx - dx*17, my + 9.5, mz - dz*17), Math.min(1, dt*2.2));
    camTgt.lerp(new THREE.Vector3(mx + dx*4, my, mz + dz*4), Math.min(1, dt*3.5));
    camera.position.copy(camPos); camera.lookAt(camTgt);
  }
  const needLoop = () => renderer && visible && !document.hidden && (current === 0 || current === 1) && (intro < 1 || flyT >= 0 || (mode === 'hero' && !reduce));
  function kick(){ if (!loopOn && needLoop()) { loopOn = true; last = performance.now(); requestAnimationFrame(frame); } }
  function frame(now){
    const dt = Math.min(.05, (now-last)/1000); last = now;
    if (intro < 1) { intro = Math.min(1, intro + dt/2.4); const e = 1 - Math.pow(1-intro, 3);
      world.scale.y = Math.max(.02, EXAG*Math.min(1, e*1.35));
      tube.geometry.setDrawRange(0, Math.floor(tubeCount*e/6)*6); ghost.geometry.setDrawRange(0, Math.floor(ghostCount*e)); placeMarker(); }
    if (mode === 'hero') { heroA += dt*.06; heroCam(); }
    if (flyT >= 0) { flyT += dt/75; if (flyT >= 1) stopFly(); else { cur = idxAtKm(flyT*D); $('km').value = T.d[cur]; readout(); drawProfile(); placeMarker(); flyCam(dt); } }
    render();
    if (needLoop()) requestAnimationFrame(frame); else loopOn = false;
  }
  document.addEventListener('visibilitychange', kick);
  function startFly(){ if (!renderer) return; flyT = 0; cur = 0; controls.enabled = false; camPos.copy(camera.position); camTgt.copy(controls.target); $('fly').textContent = '■ Parar'; kick(); }
  function stopFly(){ if (flyT < 0) return; flyT = -1; $('fly').textContent = '▶ Volar la ruta'; if (controls) { controls.enabled = mode === 'route'; homeCam(); } render(); }
  $('fly').addEventListener('click', () => flyT >= 0 ? stopFly() : startFly());
  $('home').addEventListener('click', () => { stopFly(); if (controls) { homeCam(); render(); } });

  function place(){
    if (!renderer) return;
    const want = current === 1 ? 'route' : current === 0 ? 'hero' : null;
    if (!want) return;
    const host = want === 'route' ? $('routeStage') : $('heroStage');
    if (want !== mode || renderer.domElement.parentElement !== host) {
      mode = want; host.insertBefore(renderer.domElement, host.firstChild);
      renderer.domElement.style.pointerEvents = mode === 'route' ? 'auto' : 'none';
      controls.enabled = mode === 'route'; marker.visible = mode === 'route';
      fit(); if (mode === 'route') homeCam(); else heroCam(); placeMarker(); render();
    }
  }

  function init3D(){
    if (!window.THREE || !THREE.OrbitControls) return;
    try { renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'}); } catch(e) { renderer = null; }
    if (!renderer) { $('routeStage').insertAdjacentHTML('afterbegin', '<p class="note" style="padding:16px">Este navegador no puede mostrar la vista 3D. El perfil y los horarios funcionan igual.</p>'); $('fly').hidden = $('home').hidden = true; return; }
    renderer.setPixelRatio(Math.min(3, devicePixelRatio || 1)); renderer.setClearColor(0, 0);
    renderer.domElement.addEventListener('webglcontextlost', e => e.preventDefault());
    camPos = new THREE.Vector3(); camTgt = new THREE.Vector3();
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(34, 1, .5, 2000);
    scene.add(new THREE.HemisphereLight(0xe6f6f8, 0x0b1524, .85));
    const sun = new THREE.DirectionalLight(0xffffff, .95); sun.position.set(-70,70,-50); scene.add(sun);
    world = new THREE.Group(); world.scale.y = reduce ? EXAG : .02; scene.add(world);
    const W = dem.w, H = dem.h, pos = new Float32Array(W*H*3), col = new Float32Array(W*H*3);
    const ramp = [[0,[.20,.33,.45]],[150,[.27,.45,.55]],[450,[.42,.64,.69]],[900,[.59,.82,.85]],[1400,[.95,.98,.99]]];
    const shade = hg => { for (let k = 1; k < ramp.length; k++) if (hg <= ramp[k][0]) { const a = ramp[k-1], b = ramp[k], t = (hg-a[0])/(b[0]-a[0]); return a[1].map((x,j) => x + (b[1][j]-x)*t); } return ramp[ramp.length-1][1]; };
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const k = r*W+c, v = grid[k];
      pos[k*3] = P(dem.west+(c+.5)*dem.dx); pos[k*3+1] = v ? (v-1)/1000 : -.12; pos[k*3+2] = Z(dem.north-(r+.5)*dem.dy);
      const rgb = v ? shade(v-1) : [.06,.12,.2]; col[k*3] = rgb[0]; col[k*3+1] = rgb[1]; col[k*3+2] = rgb[2]; }
    // encuadre según la costa
    const bounds = new THREE.Box3(), coast = [];
    for (let r = 0; r < H; r++) { let f = -1, l = -1;
      for (let c = 0; c < W; c++) if (grid[r*W+c]) { const k = r*W+c; bounds.expandByPoint(new THREE.Vector3(pos[k*3], pos[k*3+1]*EXAG, pos[k*3+2])); if (f < 0) f = k; l = k; }
      if (f >= 0) for (const k of [f,l]) coast.push({x:pos[k*3], z:pos[k*3+2]}); }
    coast.sort((a,b) => a.x-b.x || a.z-b.z);
    const cross = (a,b,c) => (b.x-a.x)*(c.z-a.z) - (b.z-a.z)*(c.x-a.x);
    const chain = pts => { const e = []; pts.forEach(p => { while (e.length > 1 && cross(e[e.length-2], e[e.length-1], p) <= 0) e.pop(); e.push(p); }); e.pop(); return e; };
    heroCenter = bounds.getCenter(new THREE.Vector3());
    chain(coast).concat(chain(coast.slice().reverse())).forEach(p => { for (const y of [bounds.min.y, bounds.max.y]) heroCorners.push(new THREE.Vector3(p.x, y, p.z)); });
    const idx = [];
    for (let r = 0; r < H-1; r++) for (let c = 0; c < W-1; c++) { const a = r*W+c, b = a+W, c2 = a+1, d = b+1; if (!(grid[a]||grid[b]||grid[c2]||grid[d])) continue; idx.push(a,b,c2, b,d,c2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx),1)); geo.computeVertexNormals();
    world.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide})));
    const pts = [];
    for (let i = 0; i < N; i += 3) pts.push(new THREE.Vector3(P(T.lon[i]), trackY(i), Z(T.lat[i])));
    pts.push(new THREE.Vector3(P(T.lon[N-1]), trackY(N-1), Z(T.lat[N-1])));
    const salmon = new THREE.Color('#ff9e7a');
    tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), pts.length*2, .34, 6, false), new THREE.MeshBasicMaterial({color:salmon}));
    tubeCount = tube.geometry.index.count; world.add(tube);
    ghost = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color:salmon, transparent:true, opacity:.35, depthTest:false}));
    ghostCount = pts.length; ghost.renderOrder = 2; world.add(ghost);
    if (!reduce) { tube.geometry.setDrawRange(0,0); ghost.geometry.setDrawRange(0,0); }
    const dotM = new THREE.MeshBasicMaterial({color:0xffffff});
    DATA.wps.forEach(w => { if (!LABELS.includes(w.n) && !STOPS.includes(w.n)) return;
      const s = new THREE.Mesh(new THREE.SphereGeometry(.55,12,10), dotM); s.position.set(P(T.lon[w.i]), trackY(w.i), Z(T.lat[w.i])); world.add(s); });
    LABELS.forEach(n => { const w = wp(n); if (!w) return; const el = document.createElement('div'); el.className = 'lbl';
      el.textContent = n.replace(' · salida','').replace(' (túnel)',''); $('labels').appendChild(el); labelEls.push({el, i:w.i}); });
    marker = new THREE.Mesh(new THREE.SphereGeometry(1.1,20,16), new THREE.MeshBasicMaterial({color:0xffffff}));
    marker.add(new THREE.Mesh(new THREE.SphereGeometry(1.7,20,16), new THREE.MeshBasicMaterial({color:salmon, transparent:true, opacity:.4, depthTest:false})));
    marker.renderOrder = 3; marker.visible = false; scene.add(marker);
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false; controls.minDistance = 15; controls.maxDistance = 380; controls.maxPolarAngle = Math.PI/2 - .05; controls.enabled = false;
    controls.addEventListener('change', () => { if (flyT < 0 && mode === 'route') render(); });
    $('heroStage').appendChild(renderer.domElement); renderer.domElement.style.pointerEvents = 'none';
    const ro = new ResizeObserver(fit); ro.observe($('heroStage')); ro.observe($('routeStage'));
    new IntersectionObserver(es => { visible = current !== 0 || es.some(e => e.isIntersecting); kick(); }).observe($('heroStage'));
    fit(); heroCam(); render();
  }

  // reaccionar a los cambios de vista
  onView = () => {
    if (current !== 1) stopFly();
    if (current === 5) spinOnce();
    if (current === 1) { visible = true; drawProfile(); }
    if (current === 0) visible = true;
    place(); kick();
  };

  renderTimes(); init3D(); onView();
}
