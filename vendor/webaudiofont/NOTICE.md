# 포함된 외부 코드

이 폴더의 파일은 수정 없이 그대로 가져온 것입니다(출처: `261126_WebAudioFont_guide.md` 참고).

- `WebAudioFontPlayer.js` — [surikov/webaudiofont](https://github.com/surikov/webaudiofont) (GPL-3.0)
- 아래 9개 `*_sf2_file.js` — 전부 [surikov/webaudiofontdata](https://github.com/surikov/webaudiofontdata)의
  `sound/` 밑 파일. 각 GM 프로그램 번호에 대해 엔진 자신의
  `WebAudioFontLoader.prototype.findInstrument(n)`이 실제로 고르는 바로 그
  파일(추측 아님 — Playwright로 실제 엔진을 불러와 직접 확인함).

| 우리 악기 id | GM 프로그램 | 파일 |
|---|---:|---|
| piano | 0 (Acoustic Grand Piano) | `0000_JCLive_sf2_file.js` |
| epiano | 4 (Electric Piano 1) | `0040_Aspirin_sf2_file.js` |
| guitar | 24 (Acoustic Guitar, nylon) | `0240_Aspirin_sf2_file.js` |
| eguitar | 27 (Electric Guitar, clean) | `0270_Aspirin_sf2_file.js` |
| strings | 40 (Violin) | `0400_Aspirin_sf2_file.js` |
| brass | 56 (Trumpet) | `0560_Aspirin_sf2_file.js` |
| flute | 73 (Flute) | `0730_Aspirin_sf2_file.js` |
| musicbox | 10 (Music Box) | `0100_Aspirin_sf2_file.js` |
| xylophone | 13 (Xylophone) | `0130_Aspirin_sf2_file.js` |

피아노 페이지(`piano.html`)의 위 9개 악기에만 쓰입니다(`guitar`/`strings`/
`brass`/`flute`/`musicbox`는 기존에 있던 오실레이터 악기를 같은 id로 업그레이드한
것 — 로딩 전/실패 시엔 그 오실레이터로 자동 대체됨). 나머지 악기는 그대로
`sound.js`의 오실레이터 합성을 씁니다.
