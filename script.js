/* ---- CONFIG: demo only. Move admin check to a server before going live. ---- */
const ADMIN = { email: 'admin@whisper.app', pass: 'change-me-123' };

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const mem = {};
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch (e) { return mem[k] ?? d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { mem[k] = v } }
};
let users = store.get('w_users', []), msgs = store.get('w_msgs', null), session = store.get('w_sess', null);
if (!msgs) {
  const t = Date.now();
  msgs = [
    { id: 1, uid: 'd1', name: 'Demo Sender', email: 'demo1@example.com', text: 'I still think about that road trip. Best summer ever.', mood: '💙', t: t - 3.6e6, likes: 4, liked: [] },
    { id: 2, uid: 'd2', name: 'Sample Person', email: 'sample@example.com', text: 'You’re way cooler than you think. Seriously.', mood: '🔥', t: t - 9e6, likes: 9, liked: [] },
    { id: 3, uid: 'd3', name: 'Test User', email: 'test@example.com', text: 'Sorry I never replied. I didn’t know what to say.', mood: '😮‍💨', t: t - 2.1e7, likes: 2, liked: [] }
  ]; store.set('w_msgs', msgs);
}
const moods = ['💙', '🔥', '😂', '😮‍💨', '🫶', '👀'];
let mood = moods[0], mode = 'in', agreed = false, tab = 'wall';

const hash = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = t => { const m = (Date.now() - t) / 6e4; return m < 1 ? 'just now' : m < 60 ? Math.floor(m) + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago' };
const grads = [['#FF3B4E', '#ff8a5c'], ['#7CD4FF', '#4a7bff'], ['#F4F1EC', '#7CD4FF'], ['#FF3B4E', '#7a2bff']];
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2200) }
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/ ?[AP]M/i, '') }, 1000);

/* auth */
$$('#seg button').forEach(b => b.onclick = () => {
  mode = b.dataset.m; $$('#seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#seg').classList.toggle('r', mode === 'up');
  $$('.up').forEach(e => e.classList.toggle('hidden', mode !== 'up'));
  $('#go').textContent = mode === 'up' ? 'Create account' : 'Sign in'; $('#err').textContent = '';
});
$('#sw').onclick = () => { agreed = !agreed; $('#sw').setAttribute('aria-checked', agreed) };
$('#go').onclick = async () => {
  const email = $('#email').value.trim().toLowerCase(), pass = $('#pass').value, name = $('#name').value.trim(), err = $('#err');
  err.textContent = '';
  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = 'Enter a valid email address.';
  if (pass.length < 6) return err.textContent = 'Password needs at least 6 characters.';
  if (mode === 'in') {
    if (email === ADMIN.email && pass === ADMIN.pass) return start({ id: 'admin', name: 'Owner', email, admin: true });
    const u = users.find(u => u.email === email);
    if (!u || u.h !== await hash(pass)) return err.textContent = 'Email or password is incorrect.';
    start({ id: u.id, name: u.name, email: u.email });
  } else {
    if (!name) return err.textContent = 'Add your name.';
    if (!agreed) return err.textContent = 'Click the toggle button to stay logged in.';
    if (users.some(u => u.email === email)) return err.textContent = 'That email already has an account. Sign in instead.';
    const u = { id: 'u' + Date.now(), name, email, h: await hash(pass) }; users.push(u); store.set('w_users', users);
    start(u);
  }
};
function start(u) { session = { id: u.id, name: u.name, email: u.email, admin: !!u.admin }; store.set('w_sess', session); enter() }
function enter() {
  $('#auth').classList.add('hidden'); $('#tabs').classList.remove('hidden');
  $('#adminTab').classList.toggle('hidden', !session.admin);
  go('wall'); toast('Hi ' + session.name.split(' ')[0] + ' 👋');
}
$('#out').onclick = () => { session = null; store.set('w_sess', null); $$('.screen').forEach(s => s.classList.add('hidden')); $('#tabs').classList.add('hidden'); $('#auth').classList.remove('hidden'); $('#pass').value = '' };
$('#logo').onclick = () => { $('#logo').style.transform = 'rotate(8deg) scale(1.1)'; setTimeout(() => $('#logo').style.transform = '', 250) };

/* nav */
function go(t) {
  tab = t; $$('.screen').forEach(s => s.classList.add('hidden')); $('#' + t).classList.remove('hidden'); $('#' + t).scrollTop = 0;
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'wall') drawWall(); if (t === 'me') drawMe(); if (t === 'admin') drawAdmin();
}
$$('.tab').forEach(b => b.onclick = () => go(b.dataset.t));

/* wall */
function drawWall() {
  const f = $('#feed');
  if (!msgs.length) { f.innerHTML = '<div class="empty">Nothing here yet.<br>Be the first to send a whisper.</div>'; return }
  f.innerHTML = [...msgs].sort((a, b) => b.t - a.t).map(m => {
    const g = grads[m.id % grads.length], on = m.liked.includes(session.id);
    return `<article class="card glass" style="--c1:${g[0]};--c2:${g[1]}">
      <div class="who"><div class="mask">${m.mood}</div><div><b>Anonymous</b><small>${ago(m.t)}</small></div></div>
      <p>${esc(m.text)}</p>
      <div class="tools"><button class="heart ${on ? 'on' : ''}" data-id="${m.id}">${on ? '♥' : '♡'} ${m.likes}</button></div></article>`
  }).join('');
  $$('.heart').forEach(h => h.onclick = () => {
    const m = msgs.find(x => x.id == h.dataset.id), i = m.liked.indexOf(session.id);
    if (i < 0) { m.liked.push(session.id); m.likes++ } else { m.liked.splice(i, 1); m.likes-- }
    store.set('w_msgs', msgs); drawWall();
  });
}

/* send */
$('#chips').innerHTML = moods.map((m, i) => `<button class="chip ${i ? '' : 'on'}" data-m="${m}">${m}</button>`).join('');
$$('.chip').forEach(c => c.onclick = () => { mood = c.dataset.m; $$('.chip').forEach(x => x.classList.toggle('on', x === c)) });
$('#msg').oninput = e => { $('#cnt').textContent = e.target.value.length; $('#post').disabled = !e.target.value.trim() };
$('#post').onclick = () => {
  const text = $('#msg').value.trim(); if (!text) return;
  msgs.push({ id: Date.now(), uid: session.id, name: session.name, email: session.email, text, mood, t: Date.now(), likes: 0, liked: [] });
  store.set('w_msgs', msgs); $('#msg').value = ''; $('#cnt').textContent = 0; $('#post').disabled = true;
  toast('Sent anonymously ✨'); go('wall');
};

/* profile */
function drawMe() {
  $('#hello').textContent = session.name.split(' ')[0]; $('#mail').textContent = session.email;
  const mine = msgs.filter(m => m.uid === session.id);
  $('#mine').textContent = mine.length; $('#likes').textContent = mine.reduce((a, m) => a + m.likes, 0);
}

/* admin */
function drawAdmin() {
  if (!session.admin) return;
  const q = $('#q').value.toLowerCase();
  $('#aTotal').textContent = msgs.length; $('#aUsers').textContent = new Set(msgs.map(m => m.uid)).size;
  const list = [...msgs].sort((a, b) => b.t - a.t).filter(m => (m.name + m.email + m.text).toLowerCase().includes(q));
  $('#aList').innerHTML = list.length ? list.map(m =>`<article class="card glass" style="margin:0 0 12px">
    <div class="id-strip lock" tabindex="0" role="button"><div class="real"><b>${esc(m.name)}</b><small>${esc(m.email)}</small></div></div>
    <p>${m.mood} ${esc(m.text)}</p>
    <div class="tools"><small style="color:var(--mute);align-self:center">${ago(m.t)}</small><button class="del" data-id="${m.id}">Delete</button></div></article>`).join('') : '<div class="empty">No messages match.</div>';
  $$('.id-strip').forEach(s => { s.onclick = () => s.classList.toggle('lock'); s.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.classList.toggle('lock') } } });
  $$('.del').forEach(d => d.onclick = () => { msgs = msgs.filter(m => m.id != d.dataset.id); store.set('w_msgs', msgs); drawAdmin(); toast('Deleted') });
}
$('#q').oninput = drawAdmin;

if (session) enter();
