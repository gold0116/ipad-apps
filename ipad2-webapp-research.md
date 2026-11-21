# iPad 2 (iOS 9.3.5 / Safari 9)용 웹앱·웹게임·웹 도구 자원 조사 보고서

- 조사 일자: 2026-11-21
- 조사 방법: WebSearch 9회(영어/한국어)와 WebFetch로 후보 페이지 확인. 아래 "근거" 열은 실제로 읽은 내용만 근거로 삼았습니다.
- 표기 규칙: **확인됨** = 글에서 iOS 9/구형 브라우저 동작이 명시됨, **간접** = 구형 브라우저용으로 설계됐다는 설명만 있고 iOS 9 Safari 직접 언급은 없음, **미확인** = 근거 없음.

## 바로 실행해 볼 수 있는 데모 (2026-11-21 확인)

GitHub API와 접속 시험으로 확인했습니다. "서버 응답"은 이 노트북에서 열렸다는 뜻이고, "iPad 2 동작"은 iPad 2(iOS 9.3.5)에서 직접 열어 본 결과입니다. **결론: 이 데모들 중 iPad 2에서 즐길 수 있는 게임은 없었습니다.** 구형 Safari에서 되는 게임은 직접 ES5로 만드는 것이 현실적이었습니다.

| 이름 | 실행 데모 | 소스 | 서버 응답 | iPad 2 동작 |
|---|---|---|---|---|
| iampavangandhi/JSGames | https://iampavangandhi.github.io/JSGames/ | https://github.com/iampavangandhi/JSGames | 정상(200) | **확인함(2026-11-21)**: 화면은 실행되지만 화면 비율과 크기(스케일)가 안 맞고 터치가 안 되어 게임을 즐길 수 없음 |
| taihen/games | https://taihen.github.io/games/ | https://github.com/taihen/games | 정상(200) | **확인함(2026-11-21)**: 화면이 나오지 않음(ES 모듈 사용 때문으로 추정, 미확인) |
| viveknathani/games | https://games.vivekn.dev | https://github.com/viveknathani/games | 정상(200) | **확인함(2026-11-21)**: 화면이 나오지 않음(최신 코드라 구형 Safari 미지원으로 추정, 미확인) |
| Tuinha/games | 데모 없음 | https://github.com/Tuinha/games | - | 코드만 있음(GitHub Pages 꺼짐) |

## 요약

1. "iPad 2 / iOS 9 전용 웹앱 큐레이션 사이트"나 "ES5 호환을 명시한 웹게임 GitHub 저장소 목록"은 검색으로 찾지 못했습니다.
2. 대신 구형 브라우저용 경량 웹(FrogFind, 68k.news, Wiby, Wikipedia 프록시 등 "Renegade Net/Web 1.1" 계열)이 가장 가까운 자원입니다. 다만 iOS 9 Safari 직접 검증 글은 없습니다.
3. iPad 2 활용 커뮤니티(MacRumors, Apple 커뮤니티)는 있으나 대부분 일반 활용담이고, 최신 JS 프레임워크는 iOS 9.3.5에서 안 돈다는 보고가 반복됩니다(ES6 사용, Framework7 v5 등).
4. 가장 실용적인 방향은 직접 만드는 앱을 ES5 + 단순 HTML/CSS로 작성하거나 Babel로 Safari 9 대상 트랜스파일하는 것입니다.

## 항목별 표

| 이름 | 링크 | 종류 | iOS 9 동작 근거 | 비고 |
|---|---|---|---|---|
| FrogFind | https://frogfind.com | 구형 브라우저용 검색 (DuckDuckGo 래퍼) | 간접: 접속해 "Simple Internet" 검색 페이지임을 확인. 구형 컴퓨터용 설계는 검색 결과 기사들에서 확인. iOS 9 Safari 직접 검증은 미확인 | 이 환경(서버측 fetch)에서 열렸을 뿐 iPad 2 실기 확인은 아님 |
| 68k.news / FrogRSS / Wikipedia 프록시 | FrogFind 제작자 사이트들. 개별 URL은 직접 열어보지 못해 링크 생략(소개: https://lunduke.substack.com/p/help-old-computers-use-the-web-with) | 텍스트 뉴스·위키 프록시 | 간접: 소개 글이 구형 PC용 뉴스 재가공 사이트라고 설명. iOS 9 직접 근거 미확인 | 뉴스/위키 읽기 용도 후보 |
| Web 1.1 "Renegade Net" 스레드 | https://forums.macrumors.com/threads/web-1-1-building-the-renegade-net.2290616/ | 구형 브라우저 친화 사이트 모음 (디렉터리, 검색, 뉴스, 포럼) | 간접: 표준을 HTML4, CSS2, JS 최소, TLS 없음으로 정함. 스레드에 iOS/iPad 언급 없음 | 사이트 발굴용 출발점. TLS 없는 HTTP 사이트가 많아 iOS 9 쪽 호환은 오히려 유리할 수 있으나 미확인 |
| Wiby | 위 스레드·FrogFind 소개 글에서 언급 (URL은 직접 확인하지 않음) | 가벼운 옛 웹 검색 | 간접, iOS 9 미확인 | JS 적은 소규모 사이트 위주 인덱스 |
| FOSDEM 2022 FrogFind/68k News 발표 | https://archive.fosdem.org/2022/schedule/event/retro_frogfind/ | 배경 자료 | 해당 없음 | 개념 이해용 |
| firt.dev "iOS 9" 글 | https://firt.dev/ios-9/ | 기술 자료 (Safari 9 기능 정리) | 확인됨(문서): Safari 9는 ES6 일부(class, 템플릿 문자열 등), 접두사 없는 flexbox/transition 지원. Service Worker, WebRTC, getUserMedia 등은 없음 | 2015년 글이라 오래됨. 앱 설계 체크리스트로 유용 |
| MagicMirror 포럼 글 | https://forum.magicmirror.builders/post/126775 | 커뮤니티 사례 | 확인됨(사례): iPad 2 iOS 9.3.5에서 ES6 때문에 일부 모듈이 로딩 실패. 서버가 만든 스크린샷 이미지를 웹페이지로 보여주는 우회법은 iOS 9 iPad에서 동작했다고 보고 | "서버에서 렌더링 후 이미지/단순 HTML 제공" 패턴의 근거 |
| openHAB / Home Assistant 커뮤니티 글 | https://community.openhab.org/t/cant-access-openhab3-via-safari-on-ipad-ios9-3-5/115851 , https://community.home-assistant.io/t/ipad-3-ios-9-3-5-support-or-not/172625/13 | 커뮤니티 사례 (검색 결과 요약만 확인, 본문 직접 열람은 안 함) | 검색 요약상: Framework7 v5가 Safari 9.1을 요구해 iOS 9.3.5에서 안 열림 | 본문 미열람이므로 세부는 재확인 필요 |
| MacRumors "what to do with old iPad 2" | https://forums.macrumors.com/threads/what-to-do-with-old-ipad-2.2294854 | 활용 커뮤니티 | 미확인 (fetch 403, 검색 요약만 확인) | 구형 iPad 재활용 아이디어 모음 |
| Apple 커뮤니티: 구형 iPad 2 용도 | https://discussions.apple.com/thread/255896926 | 활용 커뮤니티 | 미확인 (본문은 리다이렉트로 열람 실패) | 검색 요약상 독서, 메모, 리모컨, 카메라 등 앱 위주 |
| Apple 커뮤니티: iOS 9.3.5 브라우저 | https://discussions.apple.com/thread/250351044 | 포럼 | 간접: 서드파티 브라우저 설치 곤란, Safari 9가 최신 사이트 렌더 어려움이라는 취지 (검색 요약) | 본문 미열람 |
| taihen/games | https://github.com/taihen/games | HTML/CSS/JS 게임 저장소 | 근거 없음/부정적: README는 ES 모듈 사용(HTTP 서빙 필요)을 언급. Safari 9는 네이티브 ES 모듈 미지원으로 알려져 있어 그대로는 안 될 가능성이 큼(제 일반 지식) | 바닐라 JS지만 iOS 9 동작은 미확인 |
| Tuinha/games, viveknathani/games, iampavangandhi/JSGames | https://github.com/Tuinha/games , https://github.com/viveknathani/games , https://github.com/iampavangandhi/JSGames | 바닐라 JS 게임 저장소 | 미확인 (검색 결과 설명만 확인, 코드 열람 안 함) | ES5 여부는 소스 확인 필요 |
| itch.io HTML5 + iOS 필터 | https://itch.io/games/oldest/html5/input-phone/platform-ios | HTML5 게임 목록 | 미확인 | "오래된 순" 정렬이라 구형 기기에 맞을 가능성은 있으나 근거 없음 |
| Computerworld "12 ways to use your older iPad" | https://www.computerworld.com/article/2839444/12-ways-to-use-your-older-ipad.html | 블로그/기사 | 미확인 (본문 미열람, 앱 중심으로 추정) | 일반 활용 팁 |

## 추천 TOP 5

1. **firt.dev iOS 9 글**: Safari 9가 되는 것과 안 되는 것(Service Worker 없음 등)을 한눈에 보여 주므로 직접 만드는 앱의 설계 기준으로 가장 직접적입니다.
2. **MagicMirror 포럼 글(iPad 2 사례)**: iPad 2 iOS 9.3.5에서 ES6 때문에 깨진 실제 사례와, 서버에서 이미지로 렌더링하는 우회법이 동작했다는 보고가 있습니다.
3. **FrogFind**: 접속해 보니 단순한 검색 포털로, 구형 브라우저용 검색 출발점으로 적합합니다(iPad 2 실기 검증은 별도 필요).
4. **Web 1.1 Renegade Net 스레드**: 구형 브라우저 친화 사이트(뉴스, 위키 프록시, 디렉터리)를 한곳에서 찾을 수 있는 목록입니다.
5. **MacRumors / Apple 커뮤니티의 iPad 2 활용 스레드**: 직접 본문을 다 보진 못했지만 재활용 아이디어와 실제 제약 사례를 모으기에 좋은 커뮤니티입니다.

## 못 찾은 것 / 한계

- iPad 2 / iOS 9 전용으로 검증된 웹앱·웹게임 큐레이션 사이트와 GitHub 목록은 찾지 못했습니다.
- "ES5 호환" 또는 "Safari 9 지원"을 명시한 웹게임 저장소도 찾지 못했습니다. 위 저장소들은 후보일 뿐 동작은 미확인입니다.
- 한국어 자료는 iPad 2 웹앱 전용 가이드가 사실상 없었고 대부분 영어 포럼 글이었습니다. Reddit 본문은 직접 열지 못했습니다.
- 내 fetch는 서버 측 요청이므로 "열렸다"는 것이 "iOS 9 Safari에서 렌더된다"는 뜻이 아닙니다. 모든 항목의 최종 확인은 iPad 2 실기 테스트가 필요합니다.
- 일부 페이지(MacRumors 일부, Apple 커뮤니티 일부)는 403/리다이렉트로 본문을 못 읽어 검색 요약에만 의존했습니다. 해당 칸에 표시했습니다.
- TLS 문제: iOS 9 기기는 오래된 루트 인증서 목록 때문에 일부 HTTPS 사이트가 안 열릴 수 있다고 알려져 있으나, 이번 조사에서 근거 자료를 직접 확인하지는 못했습니다(미확인). GitHub Pages가 iPad 2에서 열리는지는 직접 테스트해야 합니다.

## 다음 단계 제안 (HTML 앱을 GitHub Pages로 올려 iPad 2에서 쓰는 사용자용)

1. 먼저 아주 작은 테스트 페이지(`document.title` 출력, `var`와 일반 함수만 사용)를 GitHub Pages에 올려 iPad 2에서 HTTPS 접속이 되는지 확인합니다.
2. 코드는 ES5 기준으로 작성하거나, Babel(target: Safari 9)로 트랜스파일한 결과물만 배포합니다. ES 모듈, `fetch`, `Promise`, `Array.from` 등은 폴리필 또는 회피가 필요할 수 있습니다(fetch는 firt.dev 글에서 언급되지 않아 미확인).
3. Service Worker 오프라인 기능은 쓸 수 없으므로 `localStorage`나 Add to Home Screen 중심으로 설계합니다.
4. 콘솔을 볼 수 없으니, 화면에 에러를 출력하는 `window.onerror` 핸들러를 넣어 두면 디버깅이 쉬워집니다.
5. 무거운 처리는 서버/빌드 단계에서 미리 렌더링해 단순 HTML이나 이미지로 제공하는 방식(MagicMirror 사례)을 고려합니다.
6. 검증한 도구와 게임 목록을 직접 저장소 README에 "iPad 2에서 확인됨 / 미확인"으로 기록해 두면 이 조사에서 비어 있는 큐레이션 역할을 스스로 채울 수 있습니다.
