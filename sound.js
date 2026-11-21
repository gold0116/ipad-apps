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
  try { musicMuted = localStorage.getItem('musicMuted') === '1'; } catch (e) {}
  var EV = (function () {
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
    while (true) {
      var e = EV[evIdx], beat = e.t + loopN * SONG_BEATS;
      var when = lastT + (beat - lastBeat) * bs;
      if (when > now + 0.4) break;
      if (when < now) when = now + 0.01;
      if (e.k === 'm') mtone(e.f, e.d * bs * 0.92, 'square', 0.045, when);
      else mtone(e.f, e.d * bs, 'triangle', 0.09, when);
      lastT = when; lastBeat = beat;
      evIdx++; if (evIdx >= EV.length) { evIdx = 0; loopN++; }
    }
  }
  function startMusic(restart) {
    wanted = true;
    if (!ctx || muted || musicMuted || playing) return;
    if (restart) { evIdx = 0; loopN = 0; }
    mGain = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
    mGain.gain.value = 1; mGain.connect(ctx.destination);
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

  var FX = {
    jump:   function () { tone(420, 0.14, 'square', 0.1, 0, 780); },
    coin:   function () { tone(988, 0.07, 'square', 0.09, 0); tone(1319, 0.14, 'square', 0.09, 0.07); },
    item:   function () { tone(523, 0.08, 'square', 0.1, 0); tone(659, 0.08, 'square', 0.1, 0.08); tone(784, 0.16, 'square', 0.1, 0.16); },
    hit:    function () { tone(320, 0.4, 'sawtooth', 0.16, 0, 50); },
    point:  function () { tone(880, 0.07, 'square', 0.09, 0); tone(880, 0.07, 'square', 0.09, 0.12); },
    move:   function () { tone(200, 0.03, 'square', 0.05, 0); },
    rotate: function () { tone(480, 0.05, 'square', 0.07, 0, 600); },
    drop:   function () { tone(140, 0.08, 'square', 0.12, 0, 80); },
    line:   function () { tone(523, 0.08, 'square', 0.1, 0); tone(659, 0.08, 'square', 0.1, 0.08); tone(784, 0.08, 'square', 0.1, 0.16); tone(1047, 0.16, 'square', 0.1, 0.24); },
    tetris: function () { var n = [523, 659, 784, 1047, 1319]; for (var i = 0; i < n.length; i++) tone(n[i], 0.1, 'square', 0.1, i * 0.07); },
    over:   function () { tone(392, 0.2, 'square', 0.12, 0, 330); tone(330, 0.2, 'square', 0.12, 0.2, 260); tone(262, 0.4, 'square', 0.12, 0.4, 130); }
  };

  window.SFX = {
    play: function (name) { if (FX[name]) FX[name](); },
    version: 14,
    info: function () { return { version: 14, supported: !!AC, started: !!ctx, state: ctx ? (ctx.state || '(없음)') : '(아직 없음)', muted: muted, music: playing, wanted: wanted, musicMuted: musicMuted }; },
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
