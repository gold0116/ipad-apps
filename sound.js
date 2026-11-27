// 효과음 (파일 없이 브라우저가 직접 소리를 만든다). 구형 Safari의 webkitAudioContext 지원.
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, muted = false;
  try { muted = localStorage.getItem('sfxMuted') === '1'; } catch (e) {}

  // 이 문서(document) 전체에 touchstart/touchend/mousedown/click/keydown마다
  // 걸려 있어서(아이폰/아이패드는 사용자가 처음 터치한 "그 이벤트 안에서" 바로
  // resume()/소리 재생을 해야만 잠금이 풀림) 건반을 한 번 누르고 뗄 때마다도
  // 두 번씩(touchstart, touchend) 불린다. ctx가 이미 'running'이면(한 번
  // 풀린 뒤에는 계속 그럼) 무음 버퍼를 또 만들어 재생할 필요가 없는데도
  // 예전엔 매번 만들어서, 건반을 누를 때마다 쓸데없는 오디오 노드 생성이
  // 하나 더 끼어들어 반응이 느려지는 원인이 됐음 — 'running'이 아닐 때만
  // (처음 잠금 풀 때, 또는 백그라운드 갔다 와서 다시 suspended 됐을 때만)
  // 그 트릭을 쓰도록 고침.
  function unlock() {
    if (!AC) return;
    if (!ctx) { try { ctx = new AC(); } catch (e) { return; } }
    preloadClips();
    wafInit();
    try {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      if (ctx.state !== 'running') {
        var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
        s.buffer = b; s.connect(ctx.destination);
        if (s.start) s.start(0); else s.noteOn(0);
      }
    } catch (e) {}
    if (wanted && !playing) startMusic(false);
  }

  // ---- 배경음악: 러시아 민요 「코로베이니키」(공개 도메인)를 코드로 연주 ----
  var wanted = false, playing = false, musicMuted = false, mTimer = null, mGain = null;
  // "내 음악"에서 곡을 WebAudioFont 고음질 샘플(피아노 등)로 듣고 싶다는 요청으로
  // 추가 — 배경음악 엔진(mtone/schedule)은 그대로 두고, 실제로 소리를 내는 부분만
  // 선택한 악기가 있으면 그쪽으로 돌린다. null이면(기본) 예전 그대로 사각파/삼각파.
  // bgInstBus는 mGain(음소거/곡 전환마다 새로 만들어짐)에 매번 다시 연결해 주는
  // 고정된 중계 버스 — WebAudioFontPlayer의 envelope 재사용 풀이 target(=이 버스)이
  // 똑같아야 작동하므로, mGain처럼 매번 새로 만들면 재사용이 안 돼 노드가 계속 쌓임.
  var bgInstrument = null, bgInstBus = null;
  function ensureBgInstBus() {
    if (!bgInstBus) bgInstBus = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
    return bgInstBus;
  }
  // mGain은 곡/음소거가 바뀔 때마다 새로 만들어지므로, bgInstBus를 "지금의" mGain에
  // 다시 이어 준다 — startMusic()이 새 mGain을 만들 때, 그리고 곡이 이미 재생 중인
  // 상태에서 사용자가 악기를 바꿀 때 둘 다에서 호출.
  function reconnectBgInstBus() {
    if (!ctx || !mGain) return;
    try { ensureBgInstBus().disconnect(); } catch (e) {}
    try { ensureBgInstBus().connect(mGain); } catch (e) {}
  }
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
    return { ev: ev, beats: beats, beat: 60 / j.bpm, scale: Math.min(1, 2.4 / maxPoly), count: ev.length, seconds: beats * 60 / j.bpm, name: j.name || '', raw: notes, tn: j.tn || null };
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
  // 사각파/삼각파 오실레이터의 음량 단위(0.028~0.09)는 WebAudioFont 샘플
  // 재생(queueWaveTable)에는 너무 작아서(그쪽은 보통 0.2~0.6대를 씀) 그대로
  // 쓰면 거의 안 들림 — 상대 음량 비율(베이스>멜로디>반주)은 그대로 두고
  // 전체만 이 배율만큼 키운다.
  var WAF_BG_VOL_SCALE = 6;
  function mtone(f, dur, type, vol, when) {
    if (bgInstrument) {
      try {
        wafEnsureInstrument(bgInstrument);
        var preset = wafPresetFor(bgInstrument);
        if (preset) {
          var midi = 69 + 12 * Math.log(f / 440) / Math.LN2;
          wafPlayer.queueWaveTable(ctx, ensureBgInstBus(), preset, when, midi, dur, vol * WAF_BG_VOL_SCALE);
          return;
        }
      } catch (e) {}
    }
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
  // force: 리듬 게임용(음소거여도 시계를 돌리려고 재생은 하되 음량만 0), lead: 첫 음까지 여유(초)
  var songT0 = 0;
  function startMusic(restart, force, lead) {
    wanted = true;
    if (!ctx || playing) return;
    if (!force && (muted || musicMuted)) return;
    if (restart) { evIdx = 0; loopN = 0; ended = false; }
    mGain = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
    mGain.gain.value = (muted || musicMuted) ? 0 : curScale; mGain.connect(ctx.destination);
    if (bgInstrument) reconnectBgInstBus();
    playing = true; lastT = ctx.currentTime + (lead || 0.15); lastBeat = EV[evIdx].t + loopN * SONG_BEATS;
    // 0박이 울리는 오디오 시각 (박 b의 시각 = songT0 + b * 박 길이)
    songT0 = lastT - lastBeat * (BEAT / tempo);
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

  // ---- piano.html(직접 친 멜로디 녹음) 지원: 악기(배음 합성 프리셋), 누르고
  // 있는 동안 우는 "라이브" 음, 녹음한 멜로디를 한 번만 재생하는 것 ----
  // 오실레이터 파형 하나만 쓰는 대신, 배음(정수 또는 정수에 가까운 배수)을
  // 여러 개 겹쳐서(각자 상대 음량을 가진 파형) 소리를 입체적으로 만든다.
  // (keithwhor/audiosynth, MIT 라이선스 — 배음 합성이라는 아이디어만 참고해서
  // 이 저장소의 실시간 오실레이터 구조에 맞게 새로 짬.)
  //
  // 소리 꼴(envelope)은 "ADSR"(Attack-Decay-Sustain-Release) — 눌렀을 때 바로
  // 최대 음량까지 확 올라갔다가(Attack), 한 단계 더 깎여서(Decay) 쉬는 음량
  // (Sustain, 건반을 누르고 있는 동안 유지되는 비율)까지 내려가고, 뗄 때
  // 비로소 0으로 잦아든다(Release). 피아노/기타/벨처럼 치면 바로 잦아드는
  // 악기는 sustain을 0에 가깝게(눌러도 안 붙잡힘), 오르간/현악처럼 계속
  // 우는 악기는 sustain을 1에 가깝게 잡아서 표현한다.
  // (g200kg/webaudio-tinysynth, Apache-2.0 — "떼는 시점까지 붙잡는 진짜
  // sustain"이라는 아이디어를 참고. Web Audio의 setTargetAtTime(지수 곡선으로
  // 목표값에 접근)을 Decay/Release 양쪽에 써서 그 곡선을 흉내냄.)
  var INSTRUMENTS = {
    piano:      { label: '피아노', harmonics: [[1, 1], [2, 0.55], [3, 0.2], [4, 0.08]], adsr: { a: 0.004, d: 0.35, s: 0.12, r: 0.25 } },
    organ:      { label: '오르간', harmonics: [[1, 1], [2, 0.5], [4, 0.25]], adsr: { a: 0.015, d: 0.05, s: 0.95, r: 0.12 } },
    synth:      { label: '신디', harmonics: [[1, 1], [2, 0.3], [3, 0.15]], adsr: { a: 0.01, d: 0.15, s: 0.6, r: 0.15 } },
    bell:       { label: '벨', harmonics: [[1, 1], [2, 0.5], [3.01, 0.33], [4.2, 0.18]], adsr: { a: 0.002, d: 0.7, s: 0.04, r: 0.35 } },
    bass:       { label: '베이스', harmonics: [[1, 1], [2, 0.25]], octave: -1, adsr: { a: 0.004, d: 0.25, s: 0.55, r: 0.15 } },
    strings:    { label: '현악(스트링)', harmonics: [[1, 1], [2, 0.4], [3, 0.25], [4, 0.1]], adsr: { a: 0.09, d: 0.3, s: 0.85, r: 0.3 } },
    brass:      { label: '금관(브라스)', harmonics: [[1, 1], [2, 0.6], [3, 0.4], [4, 0.2], [5, 0.1]], adsr: { a: 0.045, d: 0.1, s: 0.8, r: 0.15 } },
    flute:      { label: '플루트', harmonics: [[1, 1], [2, 0.12], [3, 0.04]], adsr: { a: 0.035, d: 0.06, s: 0.9, r: 0.1 } },
    clarinet:   { label: '클라리넷', harmonics: [[1, 1], [3, 0.5], [5, 0.2]], adsr: { a: 0.02, d: 0.08, s: 0.85, r: 0.12 } },
    guitar:     { label: '기타(통기타)', harmonics: [[1, 1], [2, 0.45], [3, 0.2], [4, 0.08]], adsr: { a: 0.002, d: 0.4, s: 0.02, r: 0.25 } },
    harp:       { label: '하프', harmonics: [[1, 1], [2, 0.35], [3, 0.15], [4, 0.06]], adsr: { a: 0.001, d: 0.55, s: 0.02, r: 0.3 } },
    marimba:    { label: '마림바', harmonics: [[1, 1], [3.98, 0.18]], adsr: { a: 0.001, d: 0.3, s: 0.0, r: 0.15 } },
    vibraphone: { label: '비브라폰', harmonics: [[1, 1], [4, 0.22]], adsr: { a: 0.002, d: 0.65, s: 0.08, r: 0.4 } },
    musicbox:   { label: '뮤직박스', harmonics: [[1, 1], [2, 0.4], [4.2, 0.12]], adsr: { a: 0.001, d: 0.45, s: 0.0, r: 0.25 } },
    kalimba:    { label: '칼림바', harmonics: [[1, 1], [2, 0.3], [4.3, 0.1]], adsr: { a: 0.001, d: 0.5, s: 0.0, r: 0.2 } },
    accordion:  { label: '아코디언', harmonics: [[1, 1], [2, 0.3], [3, 0.35], [5, 0.12]], adsr: { a: 0.03, d: 0.08, s: 0.85, r: 0.1 } },
    pad:        { label: '신스 패드', harmonics: [[1, 1], [2, 0.4], [3, 0.2]], adsr: { a: 0.28, d: 0.35, s: 0.8, r: 0.65 } },
    squarelead:   { label: '칩튠 리드(사각파)', harmonics: [[1, 1]], wave: 'square', adsr: { a: 0.004, d: 0.06, s: 0.65, r: 0.05 } },
    sawlead:      { label: '신스 리드(톱니파)', harmonics: [[1, 1]], wave: 'sawtooth', adsr: { a: 0.01, d: 0.1, s: 0.6, r: 0.08 } },
    trianglelead: { label: '칩튠 리드(삼각파)', harmonics: [[1, 1]], wave: 'triangle', adsr: { a: 0.004, d: 0.07, s: 0.6, r: 0.05 } },
    subbass:      { label: '서브 베이스', harmonics: [[1, 1]], octave: -2, adsr: { a: 0.01, d: 0.12, s: 0.9, r: 0.15 } },
    // 아래 3개는 WebAudioFont 샘플 전용으로 새로 추가한 악기라 기존에 쓰던
    // 오실레이터 음색이 없었음 — 샘플이 로딩 전/실패일 때 쓸 합성음을 새로 만듦
    epiano:     { label: '일렉 피아노', harmonics: [[1, 1], [2, 0.3], [3.95, 0.15]], adsr: { a: 0.005, d: 0.4, s: 0.25, r: 0.2 } },
    eguitar:    { label: '일렉 기타(클린)', harmonics: [[1, 1], [2, 0.5], [3, 0.3], [5, 0.1]], adsr: { a: 0.002, d: 0.3, s: 0.2, r: 0.2 } },
    xylophone:  { label: '실로폰', harmonics: [[1, 1], [3.9, 0.25], [6.1, 0.08]], adsr: { a: 0.001, d: 0.18, s: 0.0, r: 0.1 } }
  };
  var ADSR_DEFAULT = { a: 0.01, d: 0.15, s: 0.6, r: 0.15 };
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  // 건반을 빠르게 연달아 치면(특히 떼기 전에 다음 음을 누르는 레가토 연주)
  // 노트마다 따로 만든 group이 전부 ctx.destination에 바로 꽂혀 있어서,
  // 여러 음이 동시에 겹치는 순간 음량이 그대로 더해져 0dBFS를 넘기면서
  // "깨지는"(clipping) 소리가 났다. 모든 악기 소리를 이 공용 버스 하나를
  // 거쳐 나가게 하고, 그 버스에 DynamicsCompressorNode(여러 음이 겹쳐
  // 커져도 부드럽게 눌러줌)를 하나 끼워서 겹침 자체를 막는 대신 겹쳐도
  // 안 깨지게 만든다(아주 오래된 WebKit이라 compressor가 없으면 그냥
  // 게인만 거쳐 나가게 fallback).
  var instBusNode = null;
  function instBus() {
    if (instBusNode) return instBusNode;
    var bus = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
    bus.gain.value = 0.9;
    try {
      if (ctx.createDynamicsCompressor) {
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 10;
        comp.attack.value = 0.003; comp.release.value = 0.15;
        bus.connect(comp); comp.connect(ctx.destination);
      } else {
        bus.connect(ctx.destination);
      }
    } catch (e) { try { bus.connect(ctx.destination); } catch (e2) {} }
    instBusNode = bus;
    return bus;
  }
  // 배음 여러 개를 한 그룹으로 묶어서 울린다(그룹 전체를 gain 하나로 떼기 쉽게).
  // 건반을 누르고 있는 동안은 Attack→Decay→Sustain까지만 걸어 두고, 실제
  // Release(0으로 잦아듦)는 stop()이 불릴 때(=뗄 때) 비로소 시작한다.
  //
  // doubling(더블링)은 예전엔 이 harmonicChord 전체(배음 N개 + 포락선)를
  // 통째로 한 번 더(디튠해서) 호출해서 노트 하나 누를 때 오디오 노드가
  // 최대 2배까지 늘어났었다(배음 4개 악기라면 9개→18개). 아이패드2처럼
  // 느린 기기에서 건반 반응이 느려지는 주된 원인이라, 포락선/그룹은
  // 그대로 하나만 쓰고 "기본음(1번 배음)만" 살짝 디튠해서 한 개 더
  // 끼워 넣는 식으로 가볍게 바꿈 — 합쳐 울리는 "두꺼운" 느낌은 거의
  // 그대로 내면서 추가 노드는 오실레이터+게인 한 쌍(2개)뿐.
  function harmonicChord(freq, inst, vol, doubling) {
    if (muted || !ctx) return { stop: function () {} };
    try {
      var adsr = inst.adsr || ADSR_DEFAULT, wave = inst.wave || 'sine';
      var group = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
      group.connect(instBus());
      var t0 = ctx.currentTime, peak = vol || 0.14, a = Math.max(0.003, adsr.a);
      var sustainLevel = Math.max(0.0001, peak * adsr.s);
      var decayTau = Math.max(0.02, adsr.d / 3);
      group.gain.setValueAtTime(0.0001, t0);
      group.gain.linearRampToValueAtTime(peak, t0 + a);
      group.gain.setTargetAtTime(sustainLevel, t0 + a, decayTau);
      var oscs = [], i, h, o, g, pending = 0;
      // 오실레이터가 stop() 시각을 지나 다 울린 뒤에도 group/instBus에 그대로
      // 연결된 채 JS 참조만 없이 남으면, 최신 브라우저는 알아서 회수하지만
      // iPad 2(iOS 9 Safari)는 그 회수가 느리거나 안 돼서 건반을 칠수록
      // 오디오 그래프에 끝난 음의 노드가 계속 쌓여 점점 끊기는 원인이 됨 —
      // 끝나는 즉시(onended) 직접 disconnect해서 안 쌓이게 한다.
      function onEnded(osc, gn) {
        try { osc.disconnect(); } catch (e) {}
        try { gn.disconnect(); } catch (e) {}
        pending--;
        if (pending <= 0) { try { group.disconnect(); } catch (e) {} }
      }
      function trackOsc(osc, gn) {
        pending++;
        try { osc.onended = function () { onEnded(osc, gn); }; } catch (e) {}
      }
      for (i = 0; i < inst.harmonics.length; i++) {
        h = inst.harmonics[i];
        o = ctx.createOscillator(); o.type = wave; o.frequency.value = freq * h[0];
        g = ctx.createGain ? ctx.createGain() : ctx.createGainNode(); g.gain.value = h[1];
        o.connect(g); g.connect(group);
        trackOsc(o, g);
        if (o.start) o.start(); else o.noteOn(0);
        oscs.push(o);
      }
      if (doubling) {
        h = inst.harmonics[0];
        o = ctx.createOscillator(); o.type = wave; o.frequency.value = freq * 1.012 * h[0];
        g = ctx.createGain ? ctx.createGain() : ctx.createGainNode(); g.gain.value = h[1] * 0.75;
        o.connect(g); g.connect(group);
        trackOsc(o, g);
        if (o.start) o.start(); else o.noteOn(0);
        oscs.push(o);
      }
      var stopped = false;
      return {
        stop: function () {
          if (stopped || !ctx) return; stopped = true;
          try {
            var t = ctx.currentTime, rel = Math.max(0.03, adsr.r);
            // group.gain.value를 읽어서 "지금 값"으로 삼으면, 짧게 눌렀다 뗐을 때
            // (Attack/Decay 곡선이 아직 끝나지 않은 시점) 그 값이 실제 소리와
            // 안 맞을 수 있다 — 브라우저가 setTargetAtTime처럼 끝이 정해지지
            // 않은 자동화 곡선의 "지금 순간 값"을 .value getter에 실시간으로
            // 정확히 반영해 준다는 보장이 없고(특히 오래된 WebKit), 하필 안
            // 맞을 때 음량이 갑자기 어긋난 값으로 뚝 떨어지며 "덜컥"하는 클릭
            // 잡음이 남. 그래서 .value를 믿지 않고, 우리가 직접 건 자동화와
            // 똑같은 공식(Attack=선형, Decay=setTargetAtTime과 같은 지수
            // 근접식)으로 지금 시각의 값을 계산해서 그 값으로 끊는다.
            var elapsed = t - t0, cur;
            if (elapsed <= a) cur = 0.0001 + (peak - 0.0001) * Math.max(0, elapsed / a);
            else cur = sustainLevel + (peak - sustainLevel) * Math.exp(-(elapsed - a) / decayTau);
            group.gain.cancelScheduledValues(t); group.gain.setValueAtTime(cur, t);
            group.gain.setTargetAtTime(0.0001, t, rel / 3);
            var stopAt = t + rel * 4 + 0.05;
            for (var k = 0; k < oscs.length; k++) {
              if (oscs[k].stop) oscs[k].stop(stopAt);
              else (function (osc, ms) { setTimeout(function () { try { osc.noteOff(0); } catch (e) {} }, ms); })(oscs[k], (stopAt - t) * 1000);
            }
          } catch (e) {}
        }
      };
    } catch (e) { return { stop: function () {} }; }
  }
  // ---- 일부 악기는 실제 녹음 샘플(WebAudioFont)로 ----
  // 나머지 악기는 전부 그대로 오실레이터 배음 합성을 쓴다. 피아노 음질을
  // 올려달라는 요청(261126_WebAudioFont_guide.md)으로 시작해서, "다른 악기도
  // 추가하자"는 뒤이은 요청에 따라 가이드가 "필수/높음"으로 꼽은 9개로
  // 늘림 — 전부 엔진 자신의 findInstrument(GM번호)가 실제로 고르는 파일을
  // Playwright로 직접 확인해서 씀(추측 아님, vendor/webaudiofont/NOTICE.md
  // 참고). 이 스크립트들이 있는 페이지(피아노 페이지뿐)에서만 이 경로를
  // 탄다 — 다른 게임 페이지는 그 스크립트가 아예 없어서 자동으로 기존
  // 합성음 그대로 들림. 로딩 전/실패 시에도 기존 오실레이터로 자연스럽게
  // 폴백한다. 한꺼번에 다 받으면 무거우니(9개 합쳐 1.8MB) 실제로 고른
  // 악기만 그때그때 받는다(지연 로딩).
  var WAF_INSTRUMENTS = {
    piano:     { src: 'vendor/webaudiofont/0000_JCLive_sf2_file.js', variable: '_tone_0000_JCLive_sf2_file' },
    epiano:    { src: 'vendor/webaudiofont/0040_Aspirin_sf2_file.js', variable: '_tone_0040_Aspirin_sf2_file' },
    guitar:    { src: 'vendor/webaudiofont/0240_Aspirin_sf2_file.js', variable: '_tone_0240_Aspirin_sf2_file' },
    eguitar:   { src: 'vendor/webaudiofont/0270_Aspirin_sf2_file.js', variable: '_tone_0270_Aspirin_sf2_file' },
    strings:   { src: 'vendor/webaudiofont/0400_Aspirin_sf2_file.js', variable: '_tone_0400_Aspirin_sf2_file' },
    brass:     { src: 'vendor/webaudiofont/0560_Aspirin_sf2_file.js', variable: '_tone_0560_Aspirin_sf2_file' },
    flute:     { src: 'vendor/webaudiofont/0730_Aspirin_sf2_file.js', variable: '_tone_0730_Aspirin_sf2_file' },
    musicbox:  { src: 'vendor/webaudiofont/0100_Aspirin_sf2_file.js', variable: '_tone_0100_Aspirin_sf2_file' },
    xylophone: { src: 'vendor/webaudiofont/0130_Aspirin_sf2_file.js', variable: '_tone_0130_Aspirin_sf2_file' }
  };
  var wafPlayer = null, wafFailed = false;
  // 악기 id -> { status: 'loading'|'ready'|'failed', preset }. 'piano'가 먼저
  // startLoad()를 걸어놔도, 엔진의 waitLoad()는 "지금까지 건 로딩 전부가
  // 끝나야" 콜백이 와서(한 로더를 같이 쓰므로) 악기별로 독립적으로 추적할
  // 수 없다 — 그래서 waitLoad 대신 악기 하나만 보는 loader.loaded(variable)을
  // 직접 폴링해 악기마다 따로 상태를 매긴다.
  var wafState = {};
  function wafInit() {
    if (wafPlayer || wafFailed || !ctx) return;
    if (typeof WebAudioFontPlayer === 'undefined') { wafFailed = true; return; }
    try { wafPlayer = new WebAudioFontPlayer(); } catch (e) { wafFailed = true; }
  }
  function wafEnsureInstrument(id) {
    wafInit();
    if (!wafPlayer || wafFailed) return;
    var def = WAF_INSTRUMENTS[id];
    if (!def) return;
    var st = wafState[id];
    if (st && (st.status === 'loading' || st.status === 'ready')) return;
    wafState[id] = { status: 'loading', preset: null };
    try {
      wafPlayer.loader.startLoad(ctx, def.src, def.variable);
      (function poll() {
        var s = wafState[id];
        if (!s || s.status !== 'loading') return;
        if (wafPlayer.loader.loaded(def.variable)) {
          s.preset = window[def.variable] || null;
          s.status = s.preset ? 'ready' : 'failed';
        } else {
          setTimeout(poll, 250);
        }
      })();
    } catch (e) { wafState[id].status = 'failed'; }
  }
  function wafPresetFor(id) {
    var st = wafState[id];
    return (st && st.status === 'ready') ? st.preset : null;
  }
  // WebAudioFont 엔진 자신의 envelope.cancel()은 내부적으로
  // gain.cancelScheduledValues(0)을 쓰는데(끝이 아니라 "시간 0"부터 전부
  // 지움), 그러면 attack 시작점의 setValueAtTime까지 같이 지워져서 그
  // 순간 GainNode 기본값인 1.0(최대 음량)으로 튀어 올랐다가 줄어듦 —
  // 건반을 짧게 눌렀다 떼면 뗄 때 "둥" 하고 한 번 더 울리는 것처럼 들리는
  // 원인이었음(실기로 확인된 버그). 그 함수를 쓰지 않고, 지금 이 순간부터만
  // 잘라서(cancelScheduledValues(now)) 그 값을 그대로 고정한 뒤(setValueAtTime)
  // 짧게 0으로 내리는 안전한 릴리즈를 직접 구현해 피함.
  function wafRelease(env, rel) {
    if (!env || !ctx) return;
    try {
      var now = ctx.currentTime;
      env.gain.cancelScheduledValues(now);
      env.gain.setValueAtTime(env.gain.value, now);
      env.gain.linearRampToValueAtTime(0.0001, now + rel);
      if (env.audioBufferSourceNode && env.audioBufferSourceNode.stop) env.audioBufferSourceNode.stop(now + rel + 0.02);
    } catch (e) {}
  }
  // 건반 하나를 누름 — 악기/더블링/에코 설정에 맞춰 1~2개 화음 그룹을 울리고,
  // 뗄 때 호출할 stop()을 돌려준다(에코가 켜져 있으면 뗄 때 짧은 꼬리를 남김)
  function liveNoteOn(midi, instrumentId, doubling, echoOn) {
    var wafId = instrumentId || 'piano';
    wafEnsureInstrument(wafId);
    var preset = wafPresetFor(wafId);
    if (preset) {
      var env = wafPlayer.queueWaveTable(ctx, instBus(), preset, ctx.currentTime, midi, 30, 0.55);
      // 오실레이터 쪽의 "더블링"(살짝 디튠한 음 하나 더)과 같은 느낌을 내려고
      // pitch를 살짝(12센트) 올린 두 번째 성부를 작은 볼륨으로 같이 켠다.
      var env2 = doubling ? wafPlayer.queueWaveTable(ctx, instBus(), preset, ctx.currentTime, midi + 0.12, 30, 0.4) : null;
      return {
        stop: function () {
          wafRelease(env, 0.12);
          wafRelease(env2, 0.12);
          // 오실레이터 쪽 playNoteEcho와 같은 모양(점점 작아지며 3번 반복)을
          // 샘플 재생으로 그대로 흉내냄
          if (echoOn) {
            var times = 3, gap = 0.1, decay = 0.5;
            for (var i = 0; i < times; i++) wafPlayer.queueWaveTable(ctx, instBus(), preset, ctx.currentTime + i * gap, midi, 0.25, 0.3 * Math.pow(decay, i));
          }
        }
      };
    }
    var inst = INSTRUMENTS[instrumentId] || INSTRUMENTS.piano;
    var m = midi + (inst.octave || 0) * 12, freq = midiToFreq(m);
    var voice = harmonicChord(freq, inst, 0.16, doubling);
    return {
      stop: function () {
        voice.stop();
        if (echoOn) playNoteEcho(freq, 0.18, inst, 0.08, 0, 3, 0.1, 0.5, doubling);
      }
    };
  }
  // 길이가 정해진 음표 하나를 한 번만 재생 — 배음 합성 + ADSR
  // (미리듣기 / 저장된 멜로디를 효과음으로 쓸 때). 길이(dur)가 짧으면
  // Attack/Release를 그 안에 맞춰 줄인다. doubling도 harmonicChord와 같은
  // 이유로 전체를 또 재생하지 않고 기본음만 살짝 디튠해 하나 더 보탠다.
  function playNote(freq, dur, inst, vol, delay, doubling) {
    if (muted || !ctx) return;
    try {
      var adsr = inst.adsr || ADSR_DEFAULT, wave = inst.wave || 'sine';
      var t = ctx.currentTime + (delay || 0);
      var group = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
      group.connect(instBus());
      var a = Math.max(0.003, Math.min(adsr.a, dur * 0.4));
      var r = Math.max(0.015, Math.min(adsr.r, dur * 0.6));
      var sustainLevel = Math.max(0.0001, vol * adsr.s);
      var relStart = Math.max(t + a, t + dur - r);
      group.gain.setValueAtTime(0.0001, t);
      group.gain.linearRampToValueAtTime(vol, t + a);
      group.gain.setTargetAtTime(sustainLevel, t + a, Math.max(0.015, adsr.d / 3));
      group.gain.setTargetAtTime(0.0001, relStart, r / 3);
      var h, o, g, i, stopAt = t + dur + r + 0.05, pending = 0;
      // harmonicChord와 같은 이유(iPad 2에서 끝난 오실레이터/group이 안 치워져
      // 쌓이는 문제)로, 멜로디 재생 쪽(playNote)도 끝나는 즉시 명시적으로 끊는다.
      function onEnded(osc, gn) {
        try { osc.disconnect(); } catch (e) {}
        try { gn.disconnect(); } catch (e) {}
        pending--;
        if (pending <= 0) { try { group.disconnect(); } catch (e) {} }
      }
      function trackOsc(osc, gn) {
        pending++;
        try { osc.onended = function () { onEnded(osc, gn); }; } catch (e) {}
      }
      for (i = 0; i < inst.harmonics.length; i++) {
        h = inst.harmonics[i];
        o = ctx.createOscillator(); o.type = wave; o.frequency.setValueAtTime(freq * h[0], t);
        g = ctx.createGain ? ctx.createGain() : ctx.createGainNode(); g.gain.value = h[1];
        o.connect(g); g.connect(group);
        trackOsc(o, g);
        if (o.start) { o.start(t); o.stop(stopAt); } else { o.noteOn(t); o.noteOff(stopAt); }
      }
      if (doubling) {
        h = inst.harmonics[0];
        o = ctx.createOscillator(); o.type = wave; o.frequency.setValueAtTime(freq * 1.012 * h[0], t);
        g = ctx.createGain ? ctx.createGain() : ctx.createGainNode(); g.gain.value = h[1] * 0.75;
        o.connect(g); g.connect(group);
        trackOsc(o, g);
        if (o.start) { o.start(t); o.stop(stopAt); } else { o.noteOn(t); o.noteOff(stopAt); }
      }
    } catch (e) {}
  }
  // 같은 음을 점점 작아지며 되풀이(에코) — 배음 합성 버전(echo()의 악기 버전)
  function playNoteEcho(freq, dur, inst, vol, delay, times, gap, decay, doubling) {
    times = times || 3; gap = gap == null ? 0.09 : gap; decay = decay == null ? 0.55 : decay;
    for (var i = 0; i < times; i++) playNote(freq, dur, inst, (vol || 0.1) * Math.pow(decay, i), (delay || 0) + i * gap, doubling);
  }
  // 녹음된 멜로디 하나를 길이가 정해진 음표들로 한 번만 재생(미리듣기 / 효과음으로 쓸 때)
  function playVoices(freq, dur, inst, delay, doubling, echoOn, volScale) {
    volScale = volScale == null ? 1 : volScale;
    if (echoOn) playNoteEcho(freq, dur, inst, 0.13 * volScale, delay, 3, 0.09, 0.55, doubling);
    else playNote(freq, dur, inst, 0.13 * volScale, delay, doubling);
  }
  // 동시에 울리는 음이 가장 많이 겹치는 지점의 개수 — buildSong()이 배경음악의
  // 3성부 재생(mtone/schedule)에 쓰는 것과 같은 방식을 여기도 적용하기 위함.
  // notes: [{t, dur}, ...](초 단위). 시작(+1)/끝(-1) 이벤트를 시간순으로 쓸어가며
  // 셈 — 끝 이벤트를 같은 시각의 시작 이벤트보다 먼저 처리해서, 한 음이 막
  // 끝나는 바로 그 순간 시작하는 다음 음과는 안 겹친 것으로 침.
  function computeMaxPoly(notes) {
    var events = [], i, n, max = 1, cur = 0;
    for (i = 0; i < notes.length; i++) {
      n = notes[i];
      events.push([n.t, 1]);
      events.push([n.t + Math.max(0.001, n.dur), -1]);
    }
    events.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    for (i = 0; i < events.length; i++) { cur += events[i][1]; if (cur > max) max = cur; }
    return max;
  }
  // playMelody가 쓰던 "곡 전체를 한 번에 다 예약"하는 방식은, 짧은 녹음(몇 초짜리
  // 효과음 대체용)에는 문제가 없었지만 "내 음악"에서 가져온 긴 곡(100초 넘게,
  // 수백 개 음)을 돌리면 — WebAudioFontPlayer의 envelope 재사용 풀은 "실제 시간이
  // 그 음의 예약 끝(when+duration)을 지나야" 재사용하는데, 한 번에 다 미리 예약해
  // 버리면 그 시점에 실제 시간은 아직 맨 처음이라 재사용 조건이 영영 안 맞아서 음
  // 하나하나가 전부 새 노드로 쌓여(최대 수백 개) 곡이 끝날 때까지 안 치워짐 —
  // 건반을 오래 누를 때 느려지던 것과 같은 종류의 문제가 여기서도 재현됨. "내
  // 음악" 자체는 괜찮은 이유는 그쪽(mtone/schedule)이 0.4초 앞만 내다보며 그때그때
  // 예약해서 한 번에 살아있는 노드 수가 항상 적기 때문 — 그 방식을 여기도 적용.
  function scheduleMelodyNote(obj, note, when, polyScale) {
    var wafId = obj.instrument || 'piano';
    wafEnsureInstrument(wafId);
    var preset = wafPresetFor(wafId);
    if (preset) {
      wafPlayer.queueWaveTable(ctx, instBus(), preset, when, note.midi, note.dur, 0.5 * polyScale);
      if (obj.doubling) wafPlayer.queueWaveTable(ctx, instBus(), preset, when, note.midi + 0.12, note.dur, 0.35 * polyScale);
      if (obj.echo) {
        var times = 3, gap = 0.09, decay = 0.55;
        for (var k = 1; k < times; k++) {
          wafPlayer.queueWaveTable(ctx, instBus(), preset, when + k * gap, note.midi, Math.max(0.05, note.dur - k * gap), 0.22 * Math.pow(decay, k) * polyScale);
        }
      }
      return;
    }
    var inst = INSTRUMENTS[obj.instrument] || INSTRUMENTS.piano, m = note.midi + (inst.octave || 0) * 12, freq = midiToFreq(m);
    playVoices(freq, note.dur, inst, when - ctx.currentTime, obj.doubling, obj.echo, polyScale);
  }
  // 음표마다 미리 WAF 샘플이 준비됐는지 다시 확인해서(스케줄 당시가 아니라 매번
  // 그때그때), 긴 곡 재생 중간에 샘플 로딩이 끝나면 그 이후 음부터 바로 고음질로
  // 바뀌는 것도 덤으로 됨(예전엔 재생 시작 순간 한 번만 확인해서, 그 순간 샘플이
  // 아직 없으면 곡 끝까지 오실레이터로만 갔음). 반환하는 {stop} 핸들로 재생 중에도
  // 끊을 수 있음(한 번에 다 예약하던 예전 방식은 중간에 못 끊었음).
  function playMelody(obj) {
    if (muted || !ctx || !obj || !obj.notes) return null;
    var notes = obj.notes, idx = 0, t0 = ctx.currentTime + 0.03, timer;
    var polyScale = Math.min(1, 2.4 / computeMaxPoly(notes));
    function step() {
      var now = ctx.currentTime, when;
      while (idx < notes.length && t0 + notes[idx].t <= now + 0.4) {
        when = t0 + notes[idx].t; if (when < now) when = now + 0.005;
        try { scheduleMelodyNote(obj, notes[idx], when, polyScale); } catch (e) {}
        idx++;
      }
      if (idx >= notes.length && timer) { clearInterval(timer); timer = null; }
    }
    timer = setInterval(step, 120);
    step();
    return { stop: function () { if (timer) { clearInterval(timer); timer = null; } idx = notes.length; } };
  }
  // 저장된 멜로디(piano.html이 localStorage 'piano-list-v1'에 적어 둠)를 id로 찾는다
  function findMelody(id) {
    try {
      var list = JSON.parse(localStorage.getItem('piano-list-v1') || '[]'), i;
      for (i = 0; i < list.length; i++) if (list[i].id === id) return JSON.parse(list[i].text);
    } catch (e) {}
    return null;
  }
  // 효과음 이름(예: 'start')을 사용자가 녹음한 멜로디 "id"로 바꿔치기하는 매핑
  // (piano.html의 "효과음 교체(전체 게임 공통)"에서 설정, localStorage 'customFxMap-v1')
  // — id가 멜로디인지 아래 SFX_CLIPS(오디오 파일)인지는 여기서 안 가리고,
  // 실제로 재생하는 SFX.play()에서 findClip/findMelody 순서로 가려낸다.
  function customIdFor(name) {
    try {
      var map = JSON.parse(localStorage.getItem('customFxMap-v1') || '{}');
      if (map[name]) return map[name];
    } catch (e) {}
    return null;
  }
  // 같은 효과음 이름이라도 "이 게임 페이지만" 다르게 배정한 게 있으면 그걸 우선
  // (예: "시작" 소리가 스네이크·공룡·벽돌깨기 등 8개 게임에 공통인데, 벽돌깨기만
  // 다른 멜로디로 쓰고 싶은 경우 — piano.html의 "게임별 효과음 교체"에서 설정,
  // localStorage 'customFxMapPages-v1': {페이지파일명: {효과음이름: 멜로디id}})
  function customIdForPage(name) {
    try {
      var page = location.pathname.split('/').pop() || 'index.html';
      var pm = JSON.parse(localStorage.getItem('customFxMapPages-v1') || '{}');
      if (pm[page] && pm[page][name]) return pm[page][name];
    } catch (e) {}
    return null;
  }

  // ---- 참고했던 게임 저장소에서 가져온 실제 효과음 파일 ----
  // 지금까지 효과음은 전부 이 파일이 직접 합성한 소리뿐이었는데, 사용자가
  // "그동안 참고한 게임들의 진짜 효과음을 모아서 피아노 페이지에 등록해달라"고
  // 요청해서 추가. 참고했던 저장소 중 실제 오디오 에셋이 들어있던 건
  // panthitech/BubbleShooter(Android, Apache-2.0 — 벽돌깨기/버블 슈터 레벨
  // 데이터를 가져올 때 참고한 바로 그 저장소)뿐이었음(szejkerek/ArkanoidGameClone,
  // ihansolo/rush-hour-app, lazygyu/roulette는 오디오 파일이 아예 없었음).
  // 원본은 44.1kHz 스테레오 WAV(합쳐서 수 MB)라 오프라인 앱캐시에 넣기엔
  // 커서, 모노 96kbps mp3로 다시 인코딩해(짧은 효과음이라 음질 차이는
  // 거의 안 느껴짐, 총 용량 약 420KB) sfx/ 폴더에 넣어둠. 배경음악 트랙 2개
  // (happy_and_joyful_children/village)는 효과음이 아니라서 제외.
  var SFX_CLIPS = [
    { id: 'bs_bubble_shoot', name: '구슬 발사', src: 'sfx/bubble_shoot.mp3' },
    { id: 'bs_fire_bubble_shoot', name: '특수 구슬 발사', src: 'sfx/fire_bubble_shoot.mp3' },
    { id: 'bs_bubble_switch', name: '구슬 교체', src: 'sfx/bubble_switch.mp3' },
    { id: 'bs_bubble_hit', name: '구슬 부딪힘', src: 'sfx/bubble_hit.mp3' },
    { id: 'bs_bubble_pop', name: '구슬 터짐', src: 'sfx/bubble_pop.mp3' },
    { id: 'bs_add_combo', name: '콤보 추가', src: 'sfx/add_combo.mp3' },
    { id: 'bs_add_star', name: '별 획득', src: 'sfx/add_star.mp3' },
    { id: 'bs_add_booster', name: '부스터 획득', src: 'sfx/add_booster.mp3' },
    { id: 'bs_collect_item', name: '아이템 획득', src: 'sfx/collect_item.mp3' },
    { id: 'bs_calculate_score', name: '점수 계산', src: 'sfx/calculate_score.mp3' },
    { id: 'bs_bomb_explode', name: '폭탄 폭발', src: 'sfx/bomb_explode.mp3' },
    { id: 'bs_wood_explode', name: '나무 벽돌 파괴', src: 'sfx/wood_explode.mp3' },
    { id: 'bs_wheel_spin', name: '룰렛 회전', src: 'sfx/wheel_spin.mp3' },
    { id: 'bs_sweep_in', name: '쓸려 들어옴', src: 'sfx/sweep_in.mp3' },
    { id: 'bs_sweep_out', name: '쓸려 나감', src: 'sfx/sweep_out.mp3' },
    { id: 'bs_button_click', name: '버튼 클릭', src: 'sfx/button_click.mp3' },
    { id: 'bs_start_game', name: '게임 시작', src: 'sfx/start_game.mp3' },
    // 원본 파일 자체가 다른 효과음보다 훨씬 크게(평균 -8dB대, 나머지는 대부분
    // -15~-23dB대 — ffmpeg volumedetect로 직접 측정) 녹음돼 있어서 버블 슈터에서
    // 레벨을 깰 때마다 유독 소리가 큰 문제가 있었음 — vol로 재생 시에만 줄임
    // (파일 자체는 안 건드려서 "효과음 모음"에서 원본 그대로 들어볼 수 있음).
    { id: 'bs_game_complete', name: '게임 클리어', src: 'sfx/game_complete.mp3', vol: 0.3 },
    { id: 'bs_player_win', name: '승리', src: 'sfx/player_win.mp3' },
    { id: 'bs_player_loss', name: '패배', src: 'sfx/player_loss.mp3' }
  ];
  function findClip(id) {
    for (var i = 0; i < SFX_CLIPS.length; i++) if (SFX_CLIPS[i].id === id) return SFX_CLIPS[i];
    return null;
  }
  // 매번 new Audio(src).play()로 재생했더니(최신 갤럭시 S22에서도) 터치하고
  // 0.5~1초 뒤에야 소리가 나는 문제가 있었음 — HTMLMediaElement는 재생을
  // 시작할 때마다 네트워크/디코드 과정을 거치는데, 이게 효과음 같은 "눌렀을
  // 때 바로" 나와야 하는 용도엔 너무 느림. 그래서 이미 합성 효과음(tone)에
  // 쓰고 있는 것과 같은 AudioContext로, 파일을 한 번만 미리 받아서 디코드해
  // 둔 뒤(PCM 버퍼) 재생 시점엔 그 버퍼를 트는 것(BufferSource)만 하도록
  // 바꿈 — 합성음과 레이턴시가 사실상 같아짐.
  var clipBuffers = {}, clipsLoading = false;
  function preloadClips() {
    if (clipsLoading || !ctx) return;
    clipsLoading = true;
    for (var i = 0; i < SFX_CLIPS.length; i++) (function (clip) {
      try {
        var x = new XMLHttpRequest();
        x.open('GET', clip.src, true);
        x.responseType = 'arraybuffer';
        x.onload = function () {
          if (!ctx || x.status && x.status !== 200 && x.status !== 0) return;
          try {
            ctx.decodeAudioData(x.response, function (buf) { clipBuffers[clip.id] = buf; }, function () {});
          } catch (e) {}
        };
        x.send();
      } catch (e) {}
    })(SFX_CLIPS[i]);
  }
  function playClip(clip) {
    if (muted) return;
    var buf = clipBuffers[clip.id];
    // clip.vol이 있으면(원본 파일 자체가 다른 효과음보다 훨씬 크게 녹음된
    // 경우, 예: bs_game_complete) 게인 노드를 하나 끼워 그만큼만 줄인다 —
    // 없으면(대부분의 클립) 예전처럼 destination에 바로 연결.
    if (buf && ctx) {
      try {
        var src = ctx.createBufferSource();
        src.buffer = buf;
        if (clip.vol != null) {
          var g = ctx.createGain ? ctx.createGain() : ctx.createGainNode();
          g.gain.value = clip.vol;
          src.connect(g); g.connect(ctx.destination);
        } else {
          src.connect(ctx.destination);
        }
        if (src.start) src.start(0); else src.noteOn(0);
        return;
      } catch (e) {}
    }
    // 아직 디코드가 안 끝났으면(맨 처음 터치 직후 등 드문 경우) 예전 방식으로라도 재생
    try { var a = new Audio(clip.src); if (clip.vol != null) a.volume = clip.vol; a.play(); } catch (e) {}
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
    // 리듬 게임 타격음: GOOD / PERFECT·GREAT
    tap:    function () { tone(1900, 0.025, 'triangle', 0.07, 0); },
    tapp:   function () { tone(2500, 0.03, 'triangle', 0.09, 0); tone(1250, 0.07, 'sine', 0.12, 0); },
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
    tick:   function () { tone(1200, 0.02, 'square', 0.04, 0); },
    // 버블 슈터: 날아간 구슬이 아무것도 안 터뜨리고 그냥 붙을 때의 "톡"(이전엔 무음이었음)
    land:   function () { tone(260, 0.05, 'sine', 0.07, 0, 180); },
    // 버블 슈터: 폭탄/무지개 같은 특수 구슬을 쏠 때(보통 구슬 'shoot'보다 더 묵직하게)
    specialshoot: function () { tone(260, 0.12, 'sawtooth', 0.1, 0, 700); tone(520, 0.08, 'square', 0.08, 0.06, 900); },
    // 공용 버튼 클릭(짧고 가벼운 "딱")
    click:  function () { tone(1400, 0.03, 'square', 0.06, 0); }
  };

  // 게임 화면 위쪽에 "배경음" 선택 칸을 붙인다. 게임마다 선택을 기억하고,
  // 한 번도 고른 적 없으면 defaultId를 기본값으로 쓴다(안 주면 "끄기").
  // 드롭다운이 "끄기"를 보여주면서 실제로는 재생되는 모순을 막기 위해,
  // 아케이드 게임처럼 시작하면 자동 재생하고 싶은 쪽은 반드시 실제 곡
  // id(예: 'a')를 defaultId로 넘길 것 — "한 번도 안 골랐다"와 "명시적으로
  // 껐다"를 localStorage 유무만으로 구분하던 예전 방식은, 사용자가 드롭다운을
  // 건드리지 않아 화면엔 "꺼짐"이 보이는데 실제로는 재생되는 불일치를 낳았음.
  function attachBgm(defaultId) {
    defaultId = defaultId || 'off';
    var top = document.querySelector('.top');
    if (!top) return;
    // "터치 효과"(touchfx.js)와 같은 한 줄(#ctrlbar)을 공유해서 세로 공간을
    // 아낀다 — touchfx.js가 먼저 그 줄을 만들어 뒀으면 재사용하고, 없으면
    // 이 쪽에서 만든다. data-bgm 플래그로 중복 추가만 막음(bar 자체는 공용).
    var bar = document.getElementById('ctrlbar');
    if (bar) { if (bar.getAttribute('data-bgm')) return; }
    else {
      bar = document.createElement('div'); bar.id = 'ctrlbar';
      bar.style.cssText = 'background:#e9eef9;padding:6px 12px;font-size:14px;color:#334;line-height:30px;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap';
      top.parentNode.insertBefore(bar, top.nextSibling);
    }
    bar.setAttribute('data-bgm', '1');
    var page = location.pathname.split('/').pop() || 'index.html';
    var KEY = 'bgm:' + page;
    var lab = document.createElement('span'); lab.textContent = '배경음 ';
    var sel = document.createElement('select'); sel.style.cssText = 'font-size:14px;padding:4px;max-width:72%;margin-right:14px';
    // 배경음 컨트롤은 항상 맨 앞(왼쪽)에 둔다 — "터치 효과"/Auto는 보통 이
    // 함수보다 먼저 실행돼서 이미 bar에 들어가 있으므로, 뒤에서 unshift하듯
    // 맨 앞에 끼워 넣어야 "배경음 우측에 나머지 컨트롤"이라는 순서가 됨.
    bar.insertBefore(sel, bar.firstChild);
    bar.insertBefore(lab, sel);
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
      // 저장된 선택이 있으면(사용자가 한 번이라도 드롭다운을 바꾼 적 있으면)
      // 그걸 그대로 따르고, 곧바로 재생까지 시작한다(기존 동작 유지).
      // 저장된 게 없으면 defaultId를 "화면에 보여주기만" 하고 재생은 시작하지
      // 않는다 — 실제 재생 시작은 게임 자신의 musicStartIfNotOff가 "시작"
      // 시점에 맡는다. 여기서 재생까지 같이 시작해버리면, 드롭다운은 아직
      // 아무것도 "선택"한 적 없는데(저장된 값 없음) 터치 한 번(오디오 언록)
      // 만으로 배경음악이 먼저 나와버려서 "시작"과 타이밍이 어긋난다.
      var saved = null, id, ok = false;
      try { saved = localStorage.getItem(KEY); } catch (e) {}
      id = saved || defaultId;
      for (var k = 0; k < sel.options.length; k++) if (sel.options[k].value === id) ok = true;
      if (!ok) id = 'off';
      if (sel.value !== id) sel.value = id;
      if (saved && id !== 'off') apply(id, false);
    }
    sel.onchange = function () { apply(sel.value, true); };
    loadSong('b', 'bradinsky.json', function (ok) { if (ok) { add('b', '음악 B'); applySaved(); } });
    applySaved();
  }

  window.SFX = {
    attachBgm: attachBgm,
    play: function (name) {
      var id = customIdForPage(name) || customIdFor(name);
      if (id) {
        var clip = findClip(id);
        if (clip) { playClip(clip); return; }
        var mel = findMelody(id);
        if (mel) { playMelody(mel); return; }
      }
      if (FX[name]) FX[name]();
    },
    version: 50,
    // ---- 리듬 게임 / MIDI 미리 듣기용 곡 시계 ----
    now: function () { return ctx ? ctx.currentTime : -1; },
    ready: function () { return !!ctx && (!ctx.state || ctx.state === 'running'); },
    getSong: function (id) { return songs[id] || null; },
    // 곡을 한 번만(반복 없이) 재생하고 0박의 오디오 시각을 돌려준다. 실패하면 -1
    songPlay: function (id, lead) {
      if (!ctx || !songs[id]) return -1;
      wanted = false; halt(); loopOn = false; tempo = 1;
      var s = songs[id];
      EV = s.ev; SONG_BEATS = s.beats; BEAT = s.beat; curScale = s.scale || 1; evIdx = 0; loopN = 0; ended = false;
      startMusic(true, true, lead || 2);
      return playing ? songT0 : -1;
    },
    songStop: function () { wanted = false; halt(); evIdx = 0; loopN = 0; ended = false; loopOn = true; },
    liveNoteOn: liveNoteOn,
    playMelody: playMelody,
    instruments: function () {
      var out = [], k;
      for (k in INSTRUMENTS) if (INSTRUMENTS.hasOwnProperty(k)) out.push({ id: k, label: INSTRUMENTS[k].label, hq: !!WAF_INSTRUMENTS[k] });
      return out;
    },
    fxNames: function () {
      var out = [], k;
      for (k in FX) if (FX.hasOwnProperty(k)) out.push(k);
      return out;
    },
    clips: function () { return SFX_CLIPS.slice(); },
    playClipById: function (id) { var c = findClip(id); if (c) playClip(c); },
    // 피아노 페이지가 악기별 "불러오는 중" 표시를 하려고 씀 — 그 페이지에만
    // vendor/webaudiofont/ 스크립트가 있어서, 다른 페이지에선 항상 'unavailable'.
    // WebAudioFont 대상이 아닌 악기 id를 넘기면 'na'.
    instrumentSampleStatus: function (id) {
      if (!WAF_INSTRUMENTS[id]) return 'na';
      if (wafFailed) return 'unavailable';
      var st = wafState[id];
      if (!st) return 'idle';
      return st.status;
    },
    ensureInstrumentSample: wafEnsureInstrument,
    loadSong: loadSong,
    defineSong: defineSong,
    setSong: setSong,
    hasSong: function (id) { return !!songs[id]; },
    setLoop: function (v) { loopOn = !!v; if (loopOn) ended = false; },
    onMusicEnd: function (cb) { endCb = cb; },
    isPlaying: function () { return playing; },
    info: function () { return { version: 50, supported: !!AC, started: !!ctx, state: ctx ? (ctx.state || '(없음)') : '(아직 없음)', muted: muted, music: playing, wanted: wanted, musicMuted: musicMuted }; },
    isMuted: function () { return muted; },
    setMuted: function (v) {
      muted = !!v; try { localStorage.setItem('sfxMuted', muted ? '1' : '0'); } catch (e) {}
      if (muted) halt(); else if (wanted) startMusic(false);
    },
    musicStart: function (restart) { startMusic(!!restart); },
    // musicStart와 같지만, 이 페이지의 "배경음" 선택(attachBgm 드롭다운)이
    // 명시적으로 "끄기"면 켜지 않는다 — 게임이 시작할 때마다 자동으로
    // 배경음악을 트는 쪽(아케이드 게임 공통 패턴)에서, 사용자가 그 드롭다운을
    // 꺼놨는데도 음악이 다시 켜지는 버그를 막기 위함.
    musicStartIfNotOff: function (restart) {
      var off = false;
      try { off = localStorage.getItem('bgm:' + (location.pathname.split('/').pop() || 'index.html')) === 'off'; } catch (e) {}
      if (!off) startMusic(!!restart);
    },
    musicStop: function (reset) { wanted = false; halt(); if (reset) { evIdx = 0; loopN = 0; } },
    setTempo: function (m) { tempo = m; },
    // "내 음악" 재생을 고음질 WebAudioFont 악기(피아노 등)로 — id를 WAF_INSTRUMENTS에
    // 있는 값으로 주면 그 악기로, null/빈 값이면 원래 사각파/삼각파로 돌아감.
    setMusicInstrument: function (id) {
      bgInstrument = (id && WAF_INSTRUMENTS[id]) ? id : null;
      if (bgInstrument) { wafEnsureInstrument(bgInstrument); reconnectBgInstBus(); }
    },
    getMusicInstrument: function () { return bgInstrument; },
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
