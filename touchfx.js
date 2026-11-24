// 터치 피드백 효과 (모든 터치 게임 공용)
// 사용법: <script src="touchfx.js?v=2"></script> 후
//   var tfx = TouchFX.attach(document.getElementById('cv'));
//   그리고 게임 자신의 그리기 함수 맨 끝에서 매 프레임: tfx.draw(ctx);
// 대상의 기존 touchstart/move/end 리스너는 건드리지 않고 하나 더 붙을 뿐이며,
// 그리기는 게임이 이미 갖고 있는 같은 캔버스/컨텍스트에 직접 하므로
// 별도의 오버레이 캔버스를 새로 끼워 넣지 않는다(구형 Safari에서 기존
// 캔버스 위에 캔버스를 겹치면 렌더링이 꼬이는 문제가 있어 이 방식으로 바꿈).
(function () {
  var enabled = true;
  try { enabled = localStorage.getItem('touchfxOff') !== '1'; } catch (e) {}

  function attach(target) {
    var ripples = [], trail = [];
    function toLocal(t) {
      var r = target.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function ripple(p) { ripples.push({ x: p.x, y: p.y, life: 1 }); }
    function dot(p) {
      trail.push({ x: p.x, y: p.y, life: 1 });
      if (trail.length > 16) trail.shift();
    }

    target.addEventListener('touchstart', function (e) {
      if (!enabled) return;
      for (var i = 0; i < e.changedTouches.length; i++) ripple(toLocal(e.changedTouches[i]));
    }, false);
    target.addEventListener('touchmove', function (e) {
      if (!enabled) return;
      for (var i = 0; i < e.touches.length; i++) dot(toLocal(e.touches[i]));
    }, false);
    function release(e) {
      if (!enabled) return;
      for (var i = 0; i < e.changedTouches.length; i++) ripple(toLocal(e.changedTouches[i]));
    }
    target.addEventListener('touchend', release, false);
    target.addEventListener('touchcancel', release, false);

    // 게임이 자기 그리기 루프 맨 끝에서 매 프레임 호출. 같은 ctx 위에 바로 그린다.
    function draw(ctx) {
      if (!ripples.length && !trail.length) return;
      var i;
      for (i = 0; i < trail.length; i++) trail[i].life -= 0.07;
      while (trail.length && trail[0].life <= 0) trail.shift();
      ctx.save();
      ctx.lineCap = 'round';
      for (i = 1; i < trail.length; i++) {
        var a = trail[i - 1], b = trail[i];
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 * b.life) + ')';
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (i = ripples.length - 1; i >= 0; i--) {
        var p = ripples[i];
        p.life -= 0.045;
        if (p.life <= 0) { ripples.splice(i, 1); continue; }
        var rad = (1 - p.life) * 42 + 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + (p.life * 0.55) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
    return { draw: draw };
  }

  var toggleDone = false;
  function addToggle() {
    if (toggleDone) return;
    toggleDone = true;
    var top = document.querySelector('.top');
    if (!top || document.getElementById('touchfxbar')) return;
    var bar = document.createElement('div');
    bar.id = 'touchfxbar';
    bar.style.cssText = 'background:#e9eef9;padding:6px 12px;font-size:14px;color:#334;line-height:30px';
    var lab = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = enabled;
    cb.onchange = function () { setEnabled(cb.checked); };
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(' 터치 효과'));
    bar.appendChild(lab);
    top.parentNode.insertBefore(bar, top.nextSibling);
  }
  function setEnabled(v) {
    enabled = !!v;
    try { localStorage.setItem('touchfxOff', enabled ? '0' : '1'); } catch (e) {}
  }

  window.TouchFX = {
    attach: function (target) { addToggle(); return attach(target); },
    isEnabled: function () { return enabled; },
    setEnabled: setEnabled
  };
})();
