// 효과음 (파일 없이 브라우저가 직접 소리를 만든다). 구형 Safari의 webkitAudioContext 지원.
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, muted = false;
  try { muted = localStorage.getItem('sfxMuted') === '1'; } catch (e) {}

  function unlock() {
    if (!AC) return;
    if (!ctx) { try { ctx = new AC(); } catch (e) { return; } }
    try {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination);
      if (s.start) s.start(0); else s.noteOn(0);
    } catch (e) {}
    if (wanted && !playing) startMusic(false);
  }

  // ---- 배경음악: 러시아 민요 「코로베이니키」(공개 도메인)를 코드로 연주 ----
  var wanted = false, playing = false, musicMuted = false, mTimer = null, mGain = null;
  var evIdx = 0, loopN = 0, lastT = 0, lastBeat = 0, tempo = 1, SONG_BEATS = 48, BEAT = 0.4;
  var loopOn = true, ended = false, endAt = 0, endCb = null, curScale = 1;
  try { musicMuted = localStorage.getItem('musicMuted') === '1'; } catch (e) {}
  var EV_A = (function () {
    var N = { E5: 659.25, B4: 493.88, C5: 523.25, D5: 587.33, A4: 440, F5: 698.46, A5: 880, G5: 783.99, G4s: 415.3 };
    var m = [
      ['E5',1],['B4',.5],['C5',.5],['D5',1],['C5',.5],['B4',.5],
      ['A4',1],['A4',.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
      ['B4',1.5],['C5',.5],['D5',1],['E5',1],
      ['C5',1],['A4',1],['A4',2],
      ['D5',1.5],['F5',.5],['A5',1],['G5',.5],['F5',.5],
      ['E5',1.5],['C5',.5],['E5',1],['D5',.5],['C5',.5],
      ['B4',1],['B4',.5],['C5',.5],['D5',1],['E5',1],
      ['C5',1],['A4',1],['A4',2],
      ['E5',2],['C5',2],['D5',2],['B4',2],['C5',2],['A4',2],['G4s',2],['B4',2]
    ];
    var ev = [], t = 0, i, b;
    for (i = 0; i < m.length; i++) { ev.push({ t: t, f: N[m[i][0]], d: m[i][1], k: 'm' }); t += m[i][1]; }
    var roots = [110, 110, 82.4, 110, 73.4, 130.8, 82.4, 110, 110, 98, 110, 82.4];
    for (b = 0; b < roots.length; b++) {
      ev.push({ t: b * 4, f: roots[b], d: 1.8, k: 'b' });
      ev.push({ t: b * 4 + 2, f: roots[b] * 1.5, d: 1.8, k: 'b' });
    }
    ev.sort(function (a, c) { return a.t - c.t; });
    return ev;
  })();
  var EV = EV_A;
  var songs = { a: { ev: EV_A, beats: 48, beat: 0.4, scale: 1 } };
  // 곡 데이터(JSON: {name, bpm, beats, notes:[[박, MIDI음번호, 길이(박)], ...]})를 재생용 이벤트로 바꾼다
  // mix: 'band'(고음=멜로디, 중음=반주, 저음=베이스) / 'flat'(48 이하 저음, 나머지 같은 음량)
  function buildSong(j, mix) {
    var ev = [], i, n, k, notes = j.notes;
    if (!notes || !notes.length || !j.bpm) throw new Error('곡 형식이 아니에요');
    for (i = 0; i < notes.length; i++) {
      n = notes[i][1];
      if (mix === 'band') k = n >= 72 ? 'm' : (n <= 50 ? 'b' : 'a');
      else k = n <= 48 ? 'b' : 'm';
      ev.push({ t: notes[i][0], f: 440 * Math.pow(2, (n - 69) / 12), d: notes[i][2], k: k });
    }
    ev.sort(function (a, c) { return a.t - c.t; });
    // 동시에 울리는 음이 많으면 소리가 겹쳐 깨지므로 전체 음량을 낮춘다
    var maxPoly = 1, a, c2, cnt;
    for (a = 0; a < ev.length; a++) {
      cnt = 0;
      for (c2 = a; c2 >= 0 && ev[c2].t > ev[a].t - 8; c2--) if (ev[c2].t + ev[c2].d > ev[a].t) cnt++;
      if (cnt > maxPoly) maxPoly = cnt;
    }
    var last = ev[ev.length - 1];
    var beats = j.beats || Math.ceil(last.t + last.d);
    return { ev: ev, beats: beats, beat: 60 / j.bpm, scale: Math.min(1, 2.4 / maxPoly), count: ev.length, seconds: beats * 60 / j.bpm, name: j.name || '' };
  }
  function defineSong(id, obj) {
    try { var s = buildSong(obj, obj.mix || 'flat'); songs[id] = s; return { ok: true, count: s.count, seconds: s.seconds, name: s.name }; }
    catch (e) { return { ok: false, error: String(e.message || e) }; }
  }
  // 외부 곡 불러오기 (파일에서)
  function loadSong(id, url, done) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', url + '?t=' + new Date().getTime());
      x.onreadystatechange = function () {
        if (x.readyState !== 4) return;
        var ok = false;
        if (x.status === 200 || (x.status === 0 && x.responseText)) {
          try { songs[id] = buildSong(JSON.parse(x.responseText), 'band'); ok = true; } catch (e) {}
        }
        if (done) done(ok);
      };
      x.send();
    } catch (e) { if (done) done(false); }
  }
  function setSong(id) {
    var s = songs[id];
    if (!s) return;
    var was = playing;
    halt();
    EV = s.ev; SONG_BEATS = s.beats; BEAT = s.beat; curScale = s.scale || 1; evIdx = 0; loopN = 0; ended = false;
    if (wanted && was) startMusic(true);
  }
  function finishSong() {
    halt(); wanted = false; evIdx = 0; loopN = 0; ended = false;
    if (endCb) { try { endCb(); } catch (e) {} }
  }
  function mtone(f, dur, type, vol, when) {
    try {
      var o = ctx.createOscillator(), g = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, when); g.gain.setValueAtTime(vol, when + dur * 0.75); g.gain.linearRampToValueAtTime(0.0001, when + dur);
      o.connect(g); g.connect(mGain); o.start(when); o.stop(when + dur + 0.03);
    } catch (e) {}
  }
  function schedule() {
    if (!playing || !ctx) return;
    var now = ctx.currentTime, bs = BEAT / tempo;
    if (ended) { if (now >= endAt) finishSong(); return; }
    while (true) {
      var e = EV[evIdx], beat = e.t + loopN * SONG_BEATS;
      var when = lastT + (beat - lastBeat) * bs;
      if (when > now + 0.4) break;
      if (when < now) when = now + 0.01;
      if (e.k === 'm') mtone(e.f, e.d * bs * 0.92, 'square', 0.045, when);
      else if (e.k === 'a') mtone(e.f, e.d * bs * 0.9, 'square', 0.028, when);
      else mtone(e.f, e.d * bs, 'triangle', 0.09, when);
      lastT = when; lastBeat = beat;
      evIdx++;
      if (evIdx >= EV.length) {
        if (loopOn) { evIdx = 0; loopN++; }
        else { ended = true; endAt = when + e.d * bs + 0.4; break; }
      }
    }
  }
  function startMusic(restart) {
    wanted = true;
    if (!ctx || muted || musicMuted || playing) return;
    if (restart) { evIdx = 0; loopN = 0; ended = false; }
    mGain = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
    mGain.gain.value = curScale; mGain.connect(ctx.destination);
    playing = true; lastT = ctx.currentTime + 0.15; lastBeat = EV[evIdx].t + loopN * SONG_BEATS;
    mTimer = setInterval(schedule, 120); schedule();
  }
  function halt() {
    playing = false; clearInterval(mTimer); mTimer = null;
    if (mGain && ctx) { try { mGain.gain.setValueAtTime(0, ctx.currentTime); } catch (e) {} }
    mGain = null;
  }
  // 구형 기기엔 콘솔이 없어서, 자바스크립트 오류를 화면 아래에 빨간 글씨로 보여 준다
  var oldErr = window.onerror, errShown = 0;
  window.onerror = function (msg, url, line) {
    try {
      if (errShown < 3) {
        errShown++;
        var d = document.createElement('div');
        d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;background:#e5484d;color:#fff;font-size:12px;padding:4px 8px;z-index:9999;word-break:break-all';
        d.textContent = '오류: ' + msg + ' (' + String(url).split('/').pop() + ':' + line + ')';
        document.body.appendChild(d);
      }
    } catch (e) {}
    return oldErr ? oldErr.apply(this, arguments) : false;
  };
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) halt(); else if (wanted) startMusic(false);
  }, false);
  // iOS는 터치 직후에만 소리를 허용하므로 여러 이벤트에서 깨운다
  var ev = ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
  // 세 번째 인자 true(캡처): 게임 쪽에서 stopPropagation을 해도 먼저 받는다
  for (var i = 0; i < ev.length; i++) document.addEventListener(ev[i], unlock, true);

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (muted || !ctx) return;
    try {
      var t = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.linearRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      if (o.start) { o.start(t); o.stop(t + dur + 0.03); } else { o.noteOn(t); o.noteOff(t + dur + 0.03); }
    } catch (e) {}
  }

  // 같은 음을 살짝 어긋나게(디튠) 겹쳐 울려서 소리를 더 풍성하게 만든다 ("더블링")
  function dtone(freq, dur, type, vol, delay) {
    tone(freq, dur, type, (vol || 0.12) * 0.75, delay);
    tone(freq * 1.012, dur, type, (vol || 0.12) * 0.6, delay);
  }
  // 같은 음을 점점 작아지며 여러 번 되풀이해 울림(에코)을 흉내낸다
  function echo(freq, dur, type, vol, delay, times, gap, decay) {
    times = times || 3; gap = gap == null ? 0.09 : gap; decay = decay == null ? 0.55 : decay;
    for (var i = 0; i < times; i++) tone(freq, dur, type, (vol || 0.1) * Math.pow(decay, i), (delay || 0) + i * gap);
  }

  var FX = {
    // 게임 시작: 짧게 올라가는 3음 팡파레
    start:  function () { tone(440, 0.07, 'square', 0.09, 0); tone(660, 0.08, 'square', 0.09, 0.07); tone(880, 0.13, 'square', 0.1, 0.14); },
    // 버블 슈터: 구슬 발사하는 "슝"
    shoot:  function () { tone(300, 0.1, 'square', 0.08, 0, 900); },
    jump:   function () { tone(420, 0.14, 'square', 0.1, 0, 780); },
    coin:   function () { tone(988, 0.07, 'square', 0.09, 0); tone(1319, 0.14, 'square', 0.09, 0.07); },
    item:   function () { tone(523, 0.08, 'square', 0.1, 0); tone(659, 0.08, 'square', 0.1, 0.08); tone(784, 0.16, 'square', 0.1, 0.16); },
    hit:    function () { tone(320, 0.4, 'sawtooth', 0.16, 0, 50); },
    point:  function () { tone(880, 0.07, 'square', 0.09, 0); tone(880, 0.07, 'square', 0.09, 0.12); },
    move:   function () { tone(200, 0.03, 'square', 0.05, 0); },
    // 나무 알이 판에 놓이는 "딱" / 상대 알을 잡을 때의 "딱-쿵"
    clack:    function () { tone(1500, 0.02, 'square', 0.07, 0, 700); tone(260, 0.07, 'sine', 0.22, 0, 110); },
    clackcap: function () { tone(1700, 0.02, 'square', 0.09, 0, 800); tone(240, 0.13, 'sine', 0.3, 0, 70); tone(900, 0.03, 'square', 0.06, 0.06, 400); },
    rotate: function () { tone(480, 0.05, 'square', 0.07, 0, 600); },
    drop:   function () { tone(140, 0.08, 'square', 0.12, 0, 80); },
    line:   function () { tone(523, 0.08, 'square', 0.1, 0); tone(659, 0.08, 'square', 0.1, 0.08); tone(784, 0.08, 'square', 0.1, 0.16); tone(1047, 0.16, 'square', 0.1, 0.24); },
    tetris: function () { var n = [523, 659, 784, 1047, 1319]; for (var i = 0; i < n.length; i++) tone(n[i], 0.1, 'square', 0.1, i * 0.07); },
    over:   function () { tone(392, 0.2, 'square', 0.12, 0, 330); tone(330, 0.2, 'square', 0.12, 0.2, 260); tone(262, 0.4, 'square', 0.12, 0.4, 130); },
    // 칸 하나를 조용히 여는 "톡"
    reveal: function () { tone(880, 0.035, 'square', 0.045, 0); },
    // 깃발을 꽂거나(flag) 뗄 때(unflag)
    flag:   function () { tone(660, 0.05, 'square', 0.08, 0, 880); },
    unflag: function () { tone(440, 0.05, 'square', 0.07, 0, 300); },
    // 지뢰 폭발: 낮은 쿵 소리 + 짧게 잦아드는 에코 꼬리
    boom:   function () { tone(70, 0.5, 'sawtooth', 0.22, 0, 30); tone(50, 0.55, 'square', 0.18, 0.04, 24); echo(1400, 0.03, 'square', 0.1, 0, 3, 0.05, 0.5); },
    // 게임 승리: 음계를 타고 올라간 뒤 마지막 음을 에코로 길게 늘어뜨림
    win:    function () { var n = [523, 659, 784, 1047, 1319, 1568], i; for (i = 0; i < n.length; i++) tone(n[i], 0.12, 'square', 0.1, i * 0.08); echo(1568, 0.5, 'sine', 0.12, n.length * 0.08, 3, 0.16, 0.5); },
    // 짝을 맞췄을 때: 디튠한 두 화음을 연달아 ("딩동")
    match:  function () { dtone(988, 0.16, 'square', 0.12, 0); dtone(1319, 0.22, 'square', 0.12, 0.09); },
    mismatch: function () { tone(220, 0.22, 'sawtooth', 0.13, 0, 140); },
    // 카드 뒤집기
    flip:   function () { tone(500, 0.06, 'square', 0.06, 0, 760); },
    // 두더지가 쏙 올라옴 / 맞았을 때 통쾌한 "뽕"
    pop:    function () { tone(320, 0.06, 'sine', 0.07, 0, 520); },
    bonk:   function () { tone(110, 0.1, 'square', 0.18, 0, 55); tone(1500, 0.025, 'square', 0.08, 0); echo(700, 0.05, 'triangle', 0.05, 0.03, 2, 0.06, 0.5); },
    tick:   function () { tone(1200, 0.02, 'square', 0.04, 0); }
  };

  // 게임 화면 위쪽에 "배경음" 선택 칸을 붙인다. 게임마다 선택을 기억하고, 꺼짐이 기본값.
  function attachBgm() {
    var top = document.querySelector('.top');
    if (!top || document.getElementById('bgmbar')) return;
    var page = location.pathname.split('/').pop() || 'index.html';
    var KEY = 'bgm:' + page;
    var bar = document.createElement('div'); bar.id = 'bgmbar';
    bar.style.cssText = 'background:#e9eef9;padding:6px 12px;font-size:14px;color:#334;line-height:30px';
    var lab = document.createElement('span'); lab.textContent = '배경음 ';
    var sel = document.createElement('select'); sel.style.cssText = 'font-size:14px;padding:4px;max-width:72%';
    bar.appendChild(lab); bar.appendChild(sel);
    top.parentNode.insertBefore(bar, top.nextSibling);
    function add(id, label) { var o = document.createElement('option'); o.value = id; o.textContent = label; sel.appendChild(o); }
    add('off', '끄기'); add('a', '코로베이니키 (러시아 민요)');
    try {
      var my = JSON.parse(localStorage.getItem('mymusic-list-v1') || '[]');
      for (var i = 0; i < my.length; i++) {
        var r = defineSong('my' + my[i].id, JSON.parse(my[i].text));
        if (r.ok) add('my' + my[i].id, '내 음악: ' + my[i].name);
      }
    } catch (e) {}
    function apply(id, save) {
      if (save) { try { localStorage.setItem(KEY, id); } catch (e) {} }
      if (id === 'off') { wanted = false; halt(); evIdx = 0; loopN = 0; ended = false; return; }
      loopOn = true; tempo = 1; setSong(id); startMusic(true);
    }
    function applySaved() {
      var id = 'off', ok = false;
      try { id = localStorage.getItem(KEY) || 'off'; } catch (e) {}
      for (var k = 0; k < sel.options.length; k++) if (sel.options[k].value === id) ok = true;
      if (!ok) id = 'off';
      if (sel.value !== id) sel.value = id;
      if (id !== 'off') apply(id, false);
    }
    sel.onchange = function () { apply(sel.value, true); };
    loadSong('b', 'bradinsky.json', function (ok) { if (ok) { add('b', '음악 B'); applySaved(); } });
    applySaved();
  }

  window.SFX = {
    attachBgm: attachBgm,
    play: function (name) { if (FX[name]) FX[name](); },
    version: 28,
    loadSong: loadSong,
    defineSong: defineSong,
    setSong: setSong,
    hasSong: function (id) { return !!songs[id]; },
    setLoop: function (v) { loopOn = !!v; if (loopOn) ended = false; },
    onMusicEnd: function (cb) { endCb = cb; },
    isPlaying: function () { return playing; },
    info: function () { return { version: 28, supported: !!AC, started: !!ctx, state: ctx ? (ctx.state || '(없음)') : '(아직 없음)', muted: muted, music: playing, wanted: wanted, musicMuted: musicMuted }; },
    isMuted: function () { return muted; },
    setMuted: function (v) {
      muted = !!v; try { localStorage.setItem('sfxMuted', muted ? '1' : '0'); } catch (e) {}
      if (muted) halt(); else if (wanted) startMusic(false);
    },
    musicStart: function (restart) { startMusic(!!restart); },
    musicStop: function (reset) { wanted = false; halt(); if (reset) { evIdx = 0; loopN = 0; } },
    setTempo: function (m) { tempo = m; },
    isMusicMuted: function () { return musicMuted; },
    setMusicMuted: function (v) {
      musicMuted = !!v; try { localStorage.setItem('musicMuted', musicMuted ? '1' : '0'); } catch (e) {}
      if (musicMuted) halt(); else if (wanted) startMusic(false);
    }
  };

  // 상단 바 오른쪽에 소리 켜기/끄기 버튼
  function addToggle() {
    var top = document.querySelector('.top');
    if (!top) return;
    var b = document.createElement('span');
    b.style.cssText = 'float:right;font-size:15px;font-weight:normal;padding:2px 10px;border:1px solid rgba(255,255,255,.7);border-radius:12px';
    function label() { b.textContent = muted ? '소리 꺼짐' : '소리 켜짐'; }
    b.onclick = function () { SFX.setMuted(!muted); label(); if (!muted) { unlock(); FX.coin(); } };
    label(); top.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addToggle, false); else addToggle();
})();
