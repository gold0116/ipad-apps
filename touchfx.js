// 터치 피드백 효과 (모든 터치 게임 공용)
// 사용법: <script src="touchfx.js?v=1"></script> 후 TouchFX.attach(document.getElementById('cv'));
// 대상 엘리먼트(보통 게임 캔버스) 위에 반투명 오버레이 캔버스를 올려서,
// 손을 짚은 곳에 번지는 원, 스와이프 궤적에 흐려지는 선을 그린다.
// 대상의 기존 touchstart/move/end 리스너는 건드리지 않고 그 위에 하나 더 붙을 뿐이라
// 어떤 게임의 조작 로직도 바꿀 필요가 없다.
(function () {
  function attach(target, opts) {
    opts = opts || {};
    var color = opts.color || '255,255,255';
    var wrap = target.parentNode;
    if (!wrap) return null;
    if (window.getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    var ov = document.createElement('canvas');
    ov.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    wrap.insertBefore(ov, target.nextSibling);
    var octx = ov.getContext('2d');

    function sync() {
      var r = target.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      ov.style.left = (r.left - wr.left) + 'px';
      ov.style.top = (r.top - wr.top) + 'px';
      ov.style.width = r.width + 'px';
      ov.style.height = r.height + 'px';
      ov.width = Math.max(1, Math.round(r.width * dpr));
      ov.height = Math.max(1, Math.round(r.height * dpr));
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', sync, false);
    window.addEventListener('orientationchange', sync, false);
    sync();

    function toLocal(t) {
      var r = target.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    var ripples = [], trail = [];
    function ripple(p) { ripples.push({ x: p.x, y: p.y, life: 1 }); }
    function dot(p) {
      trail.push({ x: p.x, y: p.y, life: 1 });
      if (trail.length > 16) trail.shift();
    }

    target.addEventListener('touchstart', function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) ripple(toLocal(e.changedTouches[i]));
    }, false);
    target.addEventListener('touchmove', function (e) {
      for (var i = 0; i < e.touches.length; i++) dot(toLocal(e.touches[i]));
    }, false);
    function release(e) {
      for (var i = 0; i < e.changedTouches.length; i++) ripple(toLocal(e.changedTouches[i]));
    }
    target.addEventListener('touchend', release, false);
    target.addEventListener('touchcancel', release, false);

    function render() {
      var r = target.getBoundingClientRect();
      octx.clearRect(0, 0, r.width + 2, r.height + 2);

      octx.lineCap = 'round';
      var i;
      for (i = 0; i < trail.length; i++) trail[i].life -= 0.07;
      while (trail.length && trail[0].life <= 0) trail.shift();
      for (i = 1; i < trail.length; i++) {
        var a = trail[i - 1], b = trail[i];
        octx.strokeStyle = 'rgba(' + color + ',' + (0.3 * b.life) + ')';
        octx.lineWidth = 7;
        octx.beginPath(); octx.moveTo(a.x, a.y); octx.lineTo(b.x, b.y); octx.stroke();
      }

      for (i = ripples.length - 1; i >= 0; i--) {
        var p = ripples[i];
        p.life -= 0.045;
        if (p.life <= 0) { ripples.splice(i, 1); continue; }
        var rad = (1 - p.life) * 42 + 6;
        octx.beginPath(); octx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        octx.strokeStyle = 'rgba(' + color + ',' + (p.life * 0.55) + ')';
        octx.lineWidth = 3;
        octx.stroke();
      }

      window.requestAnimationFrame(render);
    }
    window.requestAnimationFrame(render);
    return { sync: sync };
  }

  window.TouchFX = { attach: attach, version: 1 };
})();
