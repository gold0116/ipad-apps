// 시각 효과 공용 모듈 (DOM으로 만든 게임에서도 쓸 수 있음)
// VFX.burst(상자, x, y): 그 상자 안의 (x,y) 좌표에서 파티클이 튐
// VFX.flash(상자, '255,255,255'): 상자 전체가 그 색으로 살짝 번쩍임
// VFX.shake(엘리먼트): 그 엘리먼트가 짧게 흔들림 (CSS 애니메이션)
// 상자 위에 투명한 오버레이 캔버스를 하나 올려서 그리므로, 원래 있던
// 게임의 DOM 구조나 클릭 처리 로직은 전혀 건드리지 않는다.
(function () {
  function overlayFor(container) {
    if (container._vfxOv) return container;
    if (window.getComputedStyle(container).position === 'static') container.style.position = 'relative';
    var ov = document.createElement('canvas');
    ov.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    container.appendChild(ov);
    container._vfxOv = ov;
    container._vfxParticles = [];
    container._vfxFlash = null;

    function sync() {
      var r = container.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      ov.style.width = r.width + 'px'; ov.style.height = r.height + 'px';
      ov.width = Math.max(1, Math.round(r.width * dpr));
      ov.height = Math.max(1, Math.round(r.height * dpr));
      ov.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', sync, false);
    window.addEventListener('orientationchange', sync, false);
    sync();

    function render() {
      var list = container._vfxParticles, r = container.getBoundingClientRect(), ctx = ov.getContext('2d'), i, p;
      ctx.clearRect(0, 0, r.width + 2, r.height + 2);
      var f = container._vfxFlash;
      if (f) {
        f.life -= 0.07;
        if (f.life <= 0) container._vfxFlash = null;
        else { ctx.fillStyle = 'rgba(' + f.c + ',' + (f.life * 0.4) + ')'; ctx.fillRect(0, 0, r.width, r.height); }
      }
      for (i = list.length - 1; i >= 0; i--) {
        p = list[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy *= 0.94; p.life -= p.decay;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      window.requestAnimationFrame(render);
    }
    window.requestAnimationFrame(render);
    return container;
  }

  function burst(container, x, y, opts) {
    opts = opts || {};
    overlayFor(container);
    var n = opts.count || 16, colors = opts.colors || ['#ffd166', '#7ee787', '#5ec9f0', '#e5484d'];
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = (opts.speed || 2.4) * (0.5 + Math.random());
      container._vfxParticles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1,
        decay: 0.025 + Math.random() * 0.02, r: 1.5 + Math.random() * (opts.size || 2),
        c: colors[i % colors.length]
      });
    }
  }

  function flash(container, color) {
    overlayFor(container);
    container._vfxFlash = { c: color || '255,255,255', life: 1 };
  }

  var shakeCssDone = false;
  function ensureShakeCss() {
    if (shakeCssDone) return;
    shakeCssDone = true;
    var s = document.createElement('style');
    s.textContent = '@keyframes vfxShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}.vfx-shake{animation:vfxShake .36s}';
    document.head.appendChild(s);
  }
  function shake(el) {
    ensureShakeCss();
    el.classList.remove('vfx-shake');
    void el.offsetWidth;
    el.classList.add('vfx-shake');
    setTimeout(function () { el.classList.remove('vfx-shake'); }, 400);
  }

  window.VFX = { burst: burst, flash: flash, shake: shake };
})();
