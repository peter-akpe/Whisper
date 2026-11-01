/* ===== CONFIG: paste from Supabase > Project Settings > API =====
   Use the "anon public" key ONLY. Never put the service_role key here. */
const SUPABASE_URL = 'https://tnxflozbyvbqdqyslfgc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__IOtxqYRi_UkGFDtswr0Cw_gdXALwqC';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

let user = null, isAdmin = false, wall = [], hearts = [];
let unread = 0, chan = null, curTab = 'wall';
const sent = new Set();
const ts = iso => new Date(iso).getTime();
let mood = '💙', mode = 'in', agreed = false;
const moods = ['💙', '🔥', '😂', '😮‍💨', '🫶', '👀'];
const grads = [['#FF3B4E', '#ff8a5c'], ['#7CD4FF', '#4a7bff'], ['#F4F1EC', '#7CD4FF'], ['#FF3B4E', '#7a2bff']];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = iso => { const m = (Date.now() - new Date(iso)) / 6e4; return m < 1 ? 'just now' : m < 60 ? Math.floor(m) + 'm ago' : m < 1440 ? Math.floor(m / 60) + 'h ago' : Math.floor(m / 1440) + 'd ago' };
const gradFor = id => grads[parseInt(String(id).slice(0, 2), 16) % grads.length];
const firstName = () => (user.user_metadata?.name || user.email).split(' ')[0];
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400) }
setInterval(() => { $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/ ?[AP]M/i, '') }, 1000);

/* ---------- auth ---------- */
$$('#seg button').forEach(b => b.onclick = () => {
  mode = b.dataset.m; $$('#seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#seg').classList.toggle('r', mode === 'up');
  $$('.up').forEach(e => e.classList.toggle('hidden', mode !== 'up'));
  $('#go').textContent = mode === 'up' ? 'Create account' : 'Sign in'; $('#err').textContent = '';
});
$('#sw').onclick = () => { agreed = !agreed; $('#sw').setAttribute('aria-checked', agreed) };
$('#logo').onclick = () => { $('#logo').style.transform = 'rotate(8deg) scale(1.1)'; setTimeout(() => $('#logo').style.transform = '', 250) };

$('#go').onclick = async () => {
  const email = $('#email').value.trim().toLowerCase(), pass = $('#pass').value, name = $('#name').value.trim(), err = $('#err'), btn = $('#go');
  err.textContent = '';
  if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = 'Enter a valid email address.';
  if (pass.length < 8) return err.textContent = 'Password needs at least 8 characters.';
  btn.disabled = true;
  try {
    if (mode === 'in') {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) err.textContent = 'Email or password is incorrect (or email not confirmed yet).';
    } else {
      if (!name) return err.textContent = 'Add your name.';
      if (!agreed) return err.textContent = 'Turn on the privacy switch to continue.';
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } });
      if (error) err.textContent = error.message;
      else if (!data.session) err.textContent = 'Check your email to confirm your account, then sign in.';
    }
  } finally { btn.disabled = false }
};

sb.auth.onAuthStateChange((_evt, session) => {
  if (session?.user) { if (!user || user.id !== session.user.id) { user = session.user; setTimeout(enter, 0) } }
  else { user = null; isAdmin = false; showAuth() }
});

async function enter() {
  const { data } = await sb.rpc('is_admin'); isAdmin = data === true;
  await initUnread(); subscribe();
  $('#auth').classList.add('hidden'); $('#tabs').classList.remove('hidden');
  $('#adminTab').classList.toggle('hidden', !isAdmin);
  go('wall'); toast('Hi ' + firstName() + ' 👋');
}
function showAuth() {
  if (chan) { sb.removeChannel(chan); chan = null }
  unread = 0; wall = []; setBadge();
  $$('.screen').forEach(s => s.classList.add('hidden')); $('#tabs').classList.add('hidden');
  $('#auth').classList.remove('hidden'); $('#pass').value = '';
}
$('#out').onclick = () => sb.auth.signOut();

/* ---------- navigation ---------- */
function go(t) {
  curTab = t; if (t === 'wall') { unread = 0; setBadge(); }
  $$('.screen').forEach(s => s.classList.add('hidden')); $('#' + t).classList.remove('hidden'); $('#' + t).scrollTop = 0;
  $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  if (t === 'wall') drawWall(); if (t === 'me') drawMe(); if (t === 'admin') drawAdmin();
}
$$('.tab').forEach(b => b.onclick = () => go(b.dataset.t));

/* ---------- wall ---------- */
async function loadWall() {
  const [m, h] = await Promise.all([
    sb.from('messages').select('id,text,mood,created_at').order('created_at', { ascending: false }).limit(100),
    sb.from('hearts').select('message_id,user_id')
  ]);
  if (m.error) { toast('Could not load messages'); return }
  wall = m.data; hearts = h.data || [];
}
function cardHTML(m, fresh) {
  const hs = hearts.filter(h => h.message_id === m.id), on = hs.some(h => h.user_id === user.id), g = gradFor(m.id);
  return `<article class="card glass${fresh ? ' fresh' : ''}" data-mid="${esc(m.id)}" style="--c1:${g[0]};--c2:${g[1]}">
    <div class="who"><div class="mask">${esc(m.mood)}</div><div><b>Anonymous</b><small>${ago(m.created_at)}</small></div>${fresh ? '<span class="new-tag">NEW</span>' : ''}</div>
    <p>${esc(m.text)}</p>
    <div class="tools"><button class="heart ${on ? 'on' : ''}" data-id="${esc(m.id)}" data-on="${on}">${on ? '♥' : '♡'} ${hs.length}</button></div></article>`;
}
function bindHearts(root) {
  root.querySelectorAll('.heart').forEach(h => h.onclick = async () => {
    h.disabled = true;
    const q = sb.from('hearts');
    if (h.dataset.on === 'true') await q.delete().eq('message_id', h.dataset.id).eq('user_id', user.id);
    else await q.insert({ message_id: h.dataset.id, user_id: user.id });
    drawWall();
  });
}
async function drawWall() {
  await loadWall();
  const base = getSeen() ?? 0, f = $('#feed');
  if (!wall.length) { f.innerHTML = '<div class="empty">Nothing here yet.<br>Be the first to send a whisper.</div>'; markRead(); return }
  f.innerHTML = wall.map(m => cardHTML(m, ts(m.created_at) > base && !sent.has(m.id))).join('');
  bindHearts(f);
  markRead();
}
function addCard(m) {
  const f = $('#feed');
  if (f.querySelector('[data-mid="' + m.id + '"]')) return;
  f.querySelector('.empty')?.remove();
  f.insertAdjacentHTML('afterbegin', cardHTML(m, false));
  bindHearts(f.firstElementChild);
}

/* ---------- unread badge + live messages (WhatsApp style) ---------- */
const seenKey = () => 'w_seen_' + user.id;
function getSeen() { try { const v = localStorage.getItem(seenKey()); return v === null ? null : +v } catch (e) { return null } }
function setSeen(n) { try { localStorage.setItem(seenKey(), String(n)) } catch (e) { } }
function setBadge() {
  const b = $('#badge'); if (!b) return;
  b.textContent = unread > 99 ? '99+' : unread; b.classList.toggle('hidden', unread < 1);
  document.title = (unread ? '(' + unread + ') ' : '') + 'Whisper';
}
function markRead() {
  const newest = wall.length ? ts(wall[0].created_at) : 0;
  setSeen(Math.max(getSeen() ?? 0, newest)); unread = 0; setBadge();
}
async function initUnread() {
  await loadWall();
  let seen = getSeen();
  if (seen === null) { seen = wall.length ? ts(wall[0].created_at) : 0; setSeen(seen) }
  const { data } = await sb.from('sender_identity').select('message_id').eq('user_id', user.id);
  (data || []).forEach(r => sent.add(r.message_id));
  unread = wall.filter(m => ts(m.created_at) > seen && !sent.has(m.id)).length;
  setBadge();
}
async function isMine(id) {
  if (sent.has(id)) return true;
  const { data } = await sb.from('sender_identity').select('message_id').eq('message_id', id).eq('user_id', user.id).maybeSingle();
  if (data) sent.add(id);
  return !!data;
}
async function onRealtime(p) {
  if (!user) return;
  if (p.eventType === 'DELETE') {
    const id = p.old?.id; if (!id) return;
    wall = wall.filter(m => m.id !== id);
    document.querySelector('[data-mid="' + id + '"]')?.remove();
    if (curTab === 'wall' && !wall.length) $('#feed').innerHTML = '<div class="empty">Nothing here yet.<br>Be the first to send a whisper.</div>';
    return;
  }
  if (p.eventType !== 'INSERT') return;
  const m = { id: p.new.id, text: p.new.text, mood: p.new.mood, created_at: p.new.created_at };
  if (wall.some(x => x.id === m.id)) return;
  wall.unshift(m);
  const onWall = curTab === 'wall';
  if (onWall) addCard(m);
  if (onWall && !document.hidden) { markRead(); return }   // user is looking at it: already read
  if (await isMine(m.id)) return;                           // never count your own message
  unread++; setBadge();
  if (!onWall) { toast('New message 💬'); try { navigator.vibrate?.(25) } catch (e) { } }
}
function subscribe() {
  if (chan) return;
  chan = sb.channel('whisper-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onRealtime).subscribe();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && user && curTab === 'wall') markRead() });

/* ---------- send ---------- */
$('#chips').innerHTML = moods.map((m, i) => `<button class="chip ${i ? '' : 'on'}" data-m="${m}">${m}</button>`).join('');
$$('.chip').forEach(c => c.onclick = () => { mood = c.dataset.m; $$('.chip').forEach(x => x.classList.toggle('on', x === c)) });
$('#msg').oninput = e => { $('#cnt').textContent = e.target.value.length; $('#post').disabled = !e.target.value.trim() };
$('#post').onclick = async () => {
  const text = $('#msg').value.trim(); if (!text) return;
  $('#post').disabled = true;
  const { data: newId, error } = await sb.rpc('send_message', { p_text: text, p_mood: mood });
  if (error) { toast(error.message.includes('Slow down') ? 'Slow down a little 🙏' : 'Could not send. Try again.'); $('#post').disabled = false; return }
  if (newId) sent.add(newId);
  $('#msg').value = ''; $('#cnt').textContent = 0;
  toast('Sent anonymously ✨'); go('wall');
};

/* ---------- profile ---------- */
async function drawMe() {
  $('#hello').textContent = firstName(); $('#mail').textContent = user.email;
  await loadWall();
  // RLS lets a normal user read only their own rows; admin sees all, so filter by user_id
  const { data } = await sb.from('sender_identity').select('message_id').eq('user_id', user.id);
  const ids = new Set((data || []).map(r => r.message_id));
  $('#mine').textContent = ids.size;
  $('#likes').textContent = hearts.filter(h => ids.has(h.message_id)).length;
}

/* ---------- admin (data is only returned by the server if you are in the admins table) ---------- */
async function drawAdmin() {
  if (!isAdmin) return;
  const { data, error } = await sb.from('sender_identity')
    .select('name,email,message_id,messages(id,text,mood,created_at)')
    .order('created_at', { ascending: false });
  if (error) { toast('Access denied'); return }
  const q = $('#q').value.toLowerCase();
  const rows = data.filter(r => r.messages && (r.name + r.email + r.messages.text).toLowerCase().includes(q));
  $('#aTotal').textContent = data.length; $('#aUsers').textContent = new Set(data.map(r => r.email)).size;
  $('#aList').innerHTML = rows.length ? rows.map(r => `<article class="card glass" style="margin:0 0 12px">
    <div class="id-strip lock" tabindex="0" role="button"><div class="real"><b>${esc(r.name)}</b><small>${esc(r.email)}</small></div></div>
    <p>${esc(r.messages.mood)} ${esc(r.messages.text)}</p>
    <div class="tools"><small style="color:var(--mute);align-self:center">${ago(r.messages.created_at)}</small><button class="del" data-id="${esc(r.message_id)}">Delete</button></div></article>`).join('')
    : '<div class="empty">No messages match.</div>';
  $$('.id-strip').forEach(s => { s.onclick = () => s.classList.toggle('lock'); s.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.classList.toggle('lock') } } });
  $$('.del').forEach(d => d.onclick = async () => {
    if (!confirm('Delete this message?')) return;
    const { error } = await sb.from('messages').delete().eq('id', d.dataset.id);
    toast(error ? 'Could not delete' : 'Deleted'); drawAdmin();
  });
}
$('#q').oninput = drawAdmin;

/* ---------- boot ---------- */
sb.auth.getSession().then(({ data }) => { if (!data.session) showAuth() });