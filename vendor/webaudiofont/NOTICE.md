# 포함된 외부 코드

이 폴더의 파일은 수정 없이 그대로 가져온 것입니다(출처: `261126_WebAudioFont_guide.md` 참고).

- `WebAudioFontPlayer.js` — [surikov/webaudiofont](https://github.com/surikov/webaudiofont) (GPL-3.0)
- `0000_JCLive_sf2_file.js` — [surikov/webaudiofontdata](https://github.com/surikov/webaudiofontdata)의
  `sound/0000_JCLive_sf2_file.js`. GM 프로그램 0(Acoustic Grand Piano)에 대해
  엔진 자신의 `WebAudioFontLoader.prototype.findInstrument(0)`이 고르는 바로
  그 파일(추측 아님 — Playwright로 실제 엔진을 불러와 직접 확인함).

피아노 페이지(`piano.html`)의 "피아노" 악기 하나에만 쓰입니다. 나머지 19개
악기는 그대로 `sound.js`의 오실레이터 합성을 씁니다.
