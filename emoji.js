// 구형 Safari용: 이모지는 글자 크기가 안 먹어서 transform으로 키운다.
(function () {
  var BASE = 24; // 이 기기에서 이모지의 원래 크기(px). 어긋나면 이 값을 조정
  window.EMO_BASE = BASE;
  window.emo = function (ch, size, base) {
    var k = size / (base || BASE);
    return '<span class="em" style="width:' + size + 'px;height:' + size + 'px"><i style="-webkit-transform:scale(' + k + ');transform:scale(' + k + ')">' + ch + '</i></span>';
  };
  window.emoAuto = function () {
    var els = document.querySelectorAll('[data-emo]');
    for (var i = 0; i < els.length; i++) {
      els[i].innerHTML = window.emo(els[i].textContent, parseInt(els[i].getAttribute('data-emo'), 10));
    }
  };
  document.addEventListener('DOMContentLoaded', window.emoAuto, false);
})();
