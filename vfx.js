// 시각 효과 공용 모듈 (DOM으로 만든 게임에서도 쓸 수 있음)
// VFX.burstAt(엘리먼트): 그 엘리먼트 중앙에서 파티클이 튐
// VFX.burst(엘리먼트, 로컬x, 로컬y): 그 엘리먼트 기준 (x,y) 위치에서 파티클이 튐
// VFX.flash(엘리먼트, '255,255,255'): 그 엘리먼트 영역이 그 색으로 살짝 번쩍임
// VFX.shake(엘리먼트): 그 엘리먼트가 짧게 흔들림 (CSS 애니메이션)
//
// 구형 Safari(iPad 2)에서는 기존 그리드/카드 위에 캔버스를 올리거나
// 그 컨테이너에 position:relative를 주면, 이미 -webkit-transform으로
// 그려진 이모지(emoji.js)가 엉뚱한 위치로 튀는 렌더링 버그가 있었다.
// 그래서 이 버전은 게임의 DOM을 전혀 건드리지 않고, document.body에
// position:fixed 오버레이를 하나만 두고 좌표만 getBoundingClientRect()로
// 변환해서 그 위에 그린다.
//
// 주의: 이 오버레이는 자기 자신의 requestAnimationFrame 루프를 따로 돌린다.
// 벽돌깨기(breakout.html)처럼 게임 스스로도 계속 도는 rAF 루프가 있는
// 캔버스 게임에 이 모듈을 같이 쓰면(두 개의 rAF 루프가 동시에 도는 상황),
// 테스트 중 화면이 멈춰 버리는 문제(캔버스 내부 픽셀/DOM 상태는 멀쩡한데
// 화면에 그려지는 결과만 고정되는 증상)를 발견했다. 자신의 rAF 루프를 이미
// 갖고 있는 게임(스네이크, 벽돌깨기 등)은 이 모듈 대신, 그 루프 안에서
// 파티클/흔들림/플래시를 직접 그리는 방식(스네이크·벽돌깨기가 하는 방식)을
// 쓸 것. 이 모듈은 지뢰찾기/짝맞추기/두더지 잡기처럼 사용자 입력이 있을
// 때만 다시 그리는(자기 rAF 루프가 없는) 게임에만 쓰기로 한다.
(function () {
  var ov, octx, particles = [], flash = null;

  function ensureOverlay() {
    if (ov) return;
    ov = document.createElement('canvas');
    ov.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:9999;';
    document.body.appendChild(ov);
    octx = ov.getContext('2d');

    function sync() {
      var dpr = window.devicePixelRatio || 1;
      ov.style.width = window.innerWidth + 'px';
      ov.style.height = window.innerHeight + 'px';
      ov.width = Math.max(1, Math.round(window.innerWidth * dpr));
      ov.height = Math.max(1, Math.round(window.innerHeight * dpr));
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', sync, false);
    window.addEventListener('orientationchange', sync, false);
    sync();

    function render() {
      var w = window.innerWidth, h = window.innerHeight, i, p;
      octx.clearRect(0, 0, w, h);
      if (flash) {
        flash.life -= 0.07;
        if (flash.life <= 0) flash = null;
        else {
          octx.fillStyle = 'rgba(' + flash.c + ',' + (flash.life * 0.4) + ')';
          octx.fillRect(flash.x, flash.y, flash.w, flash.h);
        }
      }
      for (i = particles.length - 1; i >= 0; i--) {
        p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        octx.globalAlpha = Math.max(0, p.life);
        octx.fillStyle = p.c;
        octx.beginPath(); octx.arc(p.x, p.y, p.r, 0, Math.PI * 2); octx.fill();
      }
      octx.globalAlpha = 1;
      window.requestAnimationFrame(render);
    }
    window.requestAnimationFrame(render);
  }

  function burst(el, localX, localY, opts) {
    opts = opts || {};
    ensureOverlay();
    var r = el.getBoundingClientRect(), x = r.left + localX, y = r.top + localY;
    var n = opts.count || 16, colors = opts.colors || ['#ffd166', '#7ee787', '#5ec9f0', '#e5484d'];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (opts.speed || 2.4) * (0.5 + Math.random());
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
        decay: 0.025 + Math.random() * 0.02, r: 1.5 + Math.random() * (opts.size || 2),
        c: colors[i % colors.length]
      });
    }
  }

  function burstAt(el, opts) {
    var r = el.getBoundingClientRect();
    burst(el, r.width / 2, r.height / 2, opts);
  }

  function flashEl(el, color) {
    ensureOverlay();
    var r = el.getBoundingClientRect();
    flash = { c: color || '255,255,255', life: 1, x: r.left, y: r.top, w: r.width, h: r.height };
  }

  var shakeCssDone = false;
  function ensureShakeCss() {
    if (shakeCssDone) return;
    shakeCssDone = true;
    var s = document.createElement('style');
    s.textContent =
      '@-webkit-keyframes vfxShake{0%,100%{-webkit-transform:translateX(0)}20%{-webkit-transform:translateX(-7px)}40%{-webkit-transform:translateX(6px)}60%{-webkit-transform:translateX(-4px)}80%{-webkit-transform:translateX(3px)}}' +
      '@keyframes vfxShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}' +
      '.vfx-shake{-webkit-animation:vfxShake .36s;animation:vfxShake .36s}';
    document.head.appendChild(s);
  }
  function shake(el) {
    ensureShakeCss();
    el.classList.remove('vfx-shake');
    void el.offsetWidth;
    el.classList.add('vfx-shake');
    setTimeout(function () { el.classList.remove('vfx-shake'); }, 400);
  }

  window.VFX = { burst: burst, burstAt: burstAt, flash: flashEl, shake: shake };
})();
