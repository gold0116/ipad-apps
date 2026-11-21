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
  }
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
    info: function () { return { supported: !!AC, started: !!ctx, state: ctx ? (ctx.state || '(없음)') : '(아직 없음)', muted: muted }; },
    isMuted: function () { return muted; },
    setMuted: function (v) { muted = !!v; try { localStorage.setItem('sfxMuted', muted ? '1' : '0'); } catch (e) {} }
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
