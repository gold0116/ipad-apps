# iPad 2 가상 피아노: WebAudioFont 악기 음색 이식 가이드

## 1. 목적과 범위

기존 `gold0116/ipad-apps`의 **가상 피아노 UI/멀티터치/건반 매핑은 유지**하고, 기존 Oscillator 기반 Web Audio API 음원 생성부만 **WebAudioFont 샘플 기반 재생부**로 교체한다. MIDI 파일 재생 기능은 이번 범위가 아니다.

- 대상: iPad 2, iOS 9.3.5, Safari 9.
- 목표: 자연스러운 악기 음색, 악기 선택, 터치 즉시 발음, 기존 기능 회귀 방지.
- 구현 원칙: ES5 문법, 단일 `AudioContext`, 현재 악기 중심의 지연 로딩, 무거운 이펙트 제외.
- **주의:** WebAudioFont도 내부적으로 Web Audio API를 사용한다. 바뀌는 것은 API 자체가 아니라 `OscillatorNode` 합성에서 **샘플 기반 음원 재생**으로의 전환이다.

## 2. 공식 소스

- 엔진 GitHub: https://github.com/surikov/webaudiofont
- 공식 README / API 사용법: https://github.com/surikov/webaudiofont/blob/master/README.md
- 악기 음원 저장소: https://github.com/surikov/webaudiofontdata
- 악기별 파일 목록: https://github.com/surikov/webaudiofontdata/tree/master/sound
- 가상 피아노 예제: https://surikov.github.io/webaudiofont/examples/piano.html
- 동적 로딩 예제: https://surikov.github.io/webaudiofont/examples/dynamic.html
- 엔진 배포 파일 예시: https://surikov.github.io/webaudiofont/npm/dist/WebAudioFontPlayer.js

> 엔진 라이선스는 저장소의 GPL-3.0 표시 및 LICENSE를 확인하고, 각 SoundFont 원본 음원/프리셋의 별도 라이선스도 배포 전에 확인할 것. 기존 프로젝트의 라이선스와 호환 여부를 검토해야 한다.

## 3. 악기 선택 정책

처음부터 전체 GM SoundFont를 넣지 않는다. 다음 악기 10종을 **후보**로 두고, 저장소의 실제 프리셋 존재 여부, 음질, 크기, 라이선스를 확인해 확정한다.

| 악기 | GM program (0-based) | 우선순위 |
|---|---:|---|
| Acoustic Grand Piano | 0 | 필수 |
| Electric Piano 1 | 4 | 필수 |
| Acoustic Guitar (Nylon) | 24 | 높음 |
| Electric Guitar (Clean) | 27 | 높음 |
| Violin | 40 | 높음 |
| Trumpet | 56 | 높음 |
| Flute | 73 | 높음 |
| Music Box | 10 | 높음 |
| Xylophone | 13 | 높음 |
| Synth Lead 1 | 80 | 선택 |

**중요:** 파일명 접두 숫자는 GM program 번호를 그대로 3자리로 쓴 것이 아니다. 예를 들어 `0000_...`은 피아노 후보지만 `0250_...`은 기타 계열 프리셋일 수 있다. 실제 `sound/` 목록과 파일 내부 전역 변수명을 확인하고 명시적인 매핑 테이블을 작성한다. 파일명은 추측해서 만들지 않는다.

권장 `instruments` 메타데이터: `id`, `label`, `path`, `variable`, `estimatedBytes`, `license`, `status`. 악기마다 가장 가볍고 자연스러운 프리셋을 비교 청취해 선택한다.

## 4. 기존 코드 변경 범위

```text
기존 UI (건반, 옥타브, 멀티터치, 표시 효과)
  -> noteOn(midiPitch, touchId)
  -> AudioEngine.play()        [기존 oscillator 구현 교체]
  -> WebAudioFont.queueWaveTable()
  -> AudioContext.destination

손가락 해제 -> noteOff(touchId) -> 해당 voice만 release/cancel
악기 선택 -> loadInstrument(id) -> 로딩 완료 시 현재 악기 전환
```

- 기존 건반 이벤트 및 좌표 계산 로직은 재사용한다.
- 건반별 MIDI pitch(예: C4=60)를 엔진에 전달한다.
- 터치 식별자별 voice를 관리하여 여러 손가락의 개별 note-off를 처리한다.
- 악기 로딩 중에는 로딩 상태를 표시하고, 아직 준비되지 않은 악기를 재생하지 않는다.
- 악기 전환 요청이 연속 발생하면 마지막 선택만 적용하도록 요청 토큰을 둔다.

## 5. 최소 동작 예제 (ES5)

아래는 **이식 참고 코드**이며, 완성된 멀티터치 UI가 아니다. 공식 저장소에서 존재가 확인되는 피아노 프리셋 `0000_Aspirin_sf2_file.js`를 사용한다. 초기 검증 후 파일을 프로젝트에 복사하여 로컬 경로로 바꾸는 것이 좋다.

```html
<script src="./vendor/WebAudioFontPlayer.js"></script>
<script>
var AC = window.AudioContext || window.webkitAudioContext;
var ctx = null;
var player = null;
var currentPreset = null;
var voices = {};
var loadGeneration = 0;

var instruments = {
  piano: {
    path: './sound/0000_Aspirin_sf2_file.js',
    variable: '_tone_0000_Aspirin_sf2_file'
  }
  // 다른 악기는 실제 sound/ 목록에서 파일과 전역 변수명을 확인해 추가
};

function unlockAudio() {
  // 반드시 사용자 터치/클릭 이벤트의 직접 호출 경로에서 실행
  if (!ctx) {
    ctx = new AC();
    player = new WebAudioFontPlayer();
  }
  if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
}

function loadInstrument(id) {
  if (!ctx || !player || !instruments[id]) return;
  var info = instruments[id];
  var generation = ++loadGeneration;
  player.loader.startLoad(ctx, info.path, info.variable);
  player.loader.waitLoad(function () {
    if (generation !== loadGeneration) return;
    if (!window[info.variable]) return;
    currentPreset = window[info.variable];
    // 여기서 UI의 '악기 준비됨' 상태를 갱신
  });
}

function noteOn(pitch, touchId) {
  if (!ctx || !player || !currentPreset) return;
  // 동일 터치 ID의 중복 note-on 방지
  noteOff(touchId);
  // duration은 안전한 상한; 실제 건반 해제 시 envelope.cancel() 호출
  voices[touchId] = player.queueWaveTable(
    ctx, ctx.destination, currentPreset, ctx.currentTime, pitch, 30, 0.7
  );
}

function noteOff(touchId) {
  var voice = voices[touchId];
  if (voice && typeof voice.cancel === 'function') voice.cancel();
  delete voices[touchId];
}

function stopAllNotes() {
  for (var id in voices) {
    if (voices.hasOwnProperty(id)) noteOff(id);
  }
}

// 예: 시작 버튼 또는 첫 건반의 touchstart에서 동기적으로 호출
function onFirstUserTouch() {
  unlockAudio();
  if (!currentPreset) loadInstrument('piano');
}
</script>
```

**구현 확인 사항**

- `queueWaveTable()` 반환 envelope의 `cancel()` 동작 및 release 길이는 채택한 엔진 버전에서 확인한다. 악기별로 긴 릴리즈/즉시 끊김이 부자연스러울 수 있으므로 필요하면 짧은 release를 별도 설계한다.
- `waitLoad()`는 엔진의 로더 전체 대기 상태에 영향을 받을 수 있다. 동시 악기 로딩을 피하고 요청 토큰으로 오래된 선택 결과를 무시한다.
- iOS 9에서 `AudioContext.resume()` 동작은 실제 기기에서 검증한다. 첫 터치에서 오디오 컨텍스트를 활성화하고, 최초 음원 디코딩이 끝나기 전 건반 입력은 대기/무시 정책을 정한다.
- `touchstart`에서 `preventDefault()`를 적절히 사용하고 `touchend`뿐 아니라 `touchcancel`도 처리한다. 한 건반에 복수 터치가 들어오는 경우를 고려한다.

## 6. 악기별 음원 확보와 배포

1. `webaudiofontdata/sound`에서 각 악기에 해당하는 JS 프리셋 후보를 찾는다.
2. 데스크톱에서 음질과 크기를 비교한 뒤 iPad 2에서 재검증한다.
3. 선택한 JS 파일과 `WebAudioFontPlayer.js`를 프로젝트의 정적 파일로 포함한다.
4. `path`와 `variable`을 실제 파일 기준으로 매핑한다. 예: `0000_Aspirin_sf2_file.js` -> `_tone_0000_Aspirin_sf2_file`.
5. 앱 시작 시 피아노만 로딩한다. 다른 악기는 최초 선택 시 로딩한다.
6. 음원은 브라우저 HTTP 캐시를 활용한다. **WebAudioFont 로더는 로딩한 악기를 메모리에 캐시하므로**, `currentPreset = null`만으로 디코딩된 데이터가 완전히 해제된다고 가정하지 않는다. 메모리 누적을 측정하고 필요하면 앱 재진입/엔진 재초기화 전략을 검토한다.

초기에는 악기당 1~3MB를 **목표 예산**으로 설정하되, 이는 실제 파일 크기 보증값이 아니다. 다운로드 JS 크기뿐 아니라 디코딩 후 메모리, 초기 로딩 시간도 측정한다.

## 7. iPad 2 최적화 및 호환성

| 항목 | 1차 정책 |
|---|---|
| 브라우저 | iOS 9.3.5 Safari 9 실기기 확인 |
| 문법 | ES5 (`var`, 함수 선언), 최신 번들 문법 회피 |
| 오디오 | AudioContext 1개만 사용 |
| 악기 | 최초 피아노 1개, 선택 시 다른 악기 로딩 |
| 동시 발음 | 8개 정도부터 시작해 실측으로 조정 |
| 음역 | 기존 UI 범위를 유지, 필요하면 2~3옥타브 우선 |
| 효과 | 리버브/이퀄라이저 초기 OFF |
| 이벤트 | `touchstart`, `touchmove`, `touchend`, `touchcancel` |
| 네트워크 | 외부 CDN 의존 없이 자체 호스팅 권장 |

악기마다 note-off와 감쇠 특성이 다르다. 피아노/기타/실로폰처럼 자연 감쇠하는 악기와 바이올린/플루트처럼 유지음이 중요한 악기를 각각 시험한다. 프리셋의 샘플 길이와 루프 품질에 따라 긴 지속음이 제한될 수 있다.

## 8. 개발 순서 및 완료 조건

1. 기존 프로젝트에서 건반 UI와 오디오 엔진 경계를 파악한다.
2. 피아노 1개 프리셋으로 `noteOn`/`noteOff`를 연결하고 실기기에서 소리를 확인한다.
3. 멀티터치/옥타브/서스테인/연타/터치 취소 등 기존 기능을 회귀 테스트한다.
4. 악기 선택 UI 및 악기별 지연 로딩을 추가한다.
5. 후보 10종 중 실제 지원 가능한 악기를 선별하고 음질/용량을 측정한다.
6. iPad 2에서 첫 소리까지 지연, 연타 지연, 8음 동시 발음, 10회 이상 악기 변경 후 메모리/안정성을 검증한다.
7. 구형 Safari 호환 문제 시 엔진의 동작 가능한 커밋/배포본을 고정하고 기록한다.

**완료 기준**
- 기존 UI와 기능 유지, MIDI 파일 파서 불필요.
- 기본 피아노와 추가 악기를 선택하여 연주 가능.
- 2개 이상 손가락으로 동시에 연주하고 각각 해제 가능.
- 악기 전환 중 크래시/무음/잘못된 음색 재생 없음.
- 실제 iPad 2에서 장시간 반복 연주가 안정적임.
- 음원 라이선스 확인 완료.

## 9. 개발 에이전트에게 전달할 요청

> 현재 iPad 2용 피아노의 UI와 입력 기능을 최대한 보존하면서, 기존 Oscillator 기반 Web Audio 합성 부분을 WebAudioFont 샘플 재생으로 교체해 주세요. 우선 피아노 한 악기를 실제 iOS 9 Safari에서 검증한 다음, 악기 선택 및 동적 로딩을 추가해 주세요. 위 링크의 공식 엔진/프리셋을 사용하되 악기별 파일명과 전역 변수명은 저장소에서 직접 확인하고, 저사양 메모리/멀티터치/note-off/라이선스에 주의해 주세요. 기능 범위는 가상 건반 연주이며 MIDI 파일 재생은 추가하지 않습니다.
