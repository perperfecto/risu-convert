# risu-convert

[한국어](#한국어) · [English](#english)

---

## 한국어

**RisuAI 파일 변환 도구**입니다. 리스 확장팩(.risum)과 프리셋(.risup)을 누구나 열어 볼 수 있는 파일로 풀고, 확장팩의 세계관 사전(로어북)과 자동 바꾸기 규칙(정규식)을 다른 프론트엔드에서 쓸 수 있게 바꿔 줍니다.

> **창작자의 권리를 지켜 주세요.** 이 도구는 파일 형식을 바꿀 뿐입니다. 확장팩 안의 글·그림·설정의 저작권은 만든 사람에게 있습니다. 직접 만들었거나 만든 사람이 허락한 확장팩만 변환해 주세요.

### 설치

Node.js 18 이상만 있으면 됩니다. 따로 설치할 부품은 없습니다.

```bash
node bin/risu-convert.js --help
```

어디서나 `risu-convert` 명령으로 쓰려면 이 폴더에서 `npm install -g .`을 실행하세요.

### 사용법

| 명령 | 하는 일 |
|---|---|
| `risu-convert unpack 확장팩.risum 폴더` | 확장팩을 `module.json`(설정) + `assets/`(그림·소리) + `assets.json`(파일 목록)으로 풉니다 |
| `risu-convert pack 폴더 확장팩.risum` | 푼 폴더를 다시 .risum으로 묶습니다. 리스가 저장한 파일을 고치지 않고 다시 묶으면 원본과 똑같은 파일이 나옵니다 |
| `risu-convert preset 프리셋.risup 결과.json` | 리스 프리셋(.risup, .risupreset)을 읽을 수 있는 JSON으로 풉니다 |
| `risu-convert export 확장팩.risum 폴더` | 로어북·정규식을 다른 프론트엔드 형식으로 내보냅니다 (푼 폴더도 넣을 수 있음) |
| `risu-convert decode·encode 입력 출력` | rpack 바이트를 그대로 풀거나 묶습니다 |

파일 크기 제한은 없습니다. 큰 확장팩도 통째로 메모리에 올리지 않고 조금씩 읽어서 처리합니다. 중간에 잘리거나 손상된 파일은 오류로 알려 줍니다.

`export`는 `--to sillytavern,card,agnai`로 원하는 형식만 고를 수 있습니다(기본은 셋 다).

| 형식 | 나오는 파일 | 쓰는 곳 |
|---|---|---|
| `sillytavern` | `world_info.json`, `regex/*.json` | SillyTavern 월드 인포·정규식 가져오기 |
| `card` | `character_book.json` | Character Card V3 로어북 (Chub, RisuAI 등) |
| `agnai` | `memory_book.json` | Agnai 메모리북 |

**옮기지 못하는 것.** 변환이 끝나면 빠진 것을 형식별로 알려 줍니다.
- 리스 전용 트리거(Lua·블록)와 배경 HTML: 다른 프론트엔드에 같은 기능이 없습니다.
- 로어북 폴더: 묶음일 뿐이라 빠지고, 안의 항목은 모두 옮겨집니다.
- 번역 단계 정규식: 실리태번에 같은 단계가 없습니다.
- 정규식 키, 발동 확률, 상시 활성·보조 키(Agnai), 항목 속 `@@` 데코레이터: 형식에 따라 그대로 옮겨지지 않거나 글자로만 남습니다.

### 서버로 쓰기

`src/index.js`는 Cloudflare Worker입니다.

| 요청 | 하는 일 |
|---|---|
| `POST /decode` | rpack 바이트를 받아 풀린 바이트를 돌려줌 |
| `POST /encode` | 바이트를 받아 rpack 바이트를 돌려줌 |
| `GET /source` | 이 소스 코드의 주소 (`wrangler.jsonc`의 `SOURCE_URL`) |

크기 제한 없이 받는 대로 바꿔 흘려보내므로 메모리를 거의 쓰지 않습니다. 한 번에 보낼 수 있는 크기는 Cloudflare 요금제의 요청 한도(대부분 100MB)를 따릅니다. 바이트마다 따로 바꾸는 방식이라, 더 큰 파일은 나눠 보내고 결과를 이어 붙이면 됩니다.

배포하려면 Cloudflare 계정과 [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)가 필요합니다(Wrangler가 요구하는 Node.js 버전을 따르세요).

```bash
npx wrangler login
npx wrangler deploy
```

이 설정은 공개 주소가 꺼져 있습니다(`workers_dev: false`). 공개 주소로 쓰려면 `workers_dev`를 `true`로 바꾸세요. 고쳐서 서비스로 운영한다면 `SOURCE_URL`을 그 버전의 소스 주소로 바꿔 주세요(AGPL-3.0 13조).

### 브라우저에서 쓰기

`browser/rpack-worker.js`는 브라우저에서 rpack 변환을 하는 웹 워커입니다. `{ id, operation: "decode" | "encode", bytes }` 메시지를 받으면 `{ id, bytes }`(실패하면 `{ id, error }`)를 돌려줍니다. 브라우저 안에서 바로 변환하므로 큰 확장팩도 빠릅니다. 이 파일이 워커의 전체 소스이며 AGPL-3.0입니다.

### 라이선스

AGPL-3.0-only. rpack 바이트 표는 RisuAI(kwaroran과 기여자들)가 Risuai 밖에서의 사용에 대해 AGPL-3.0으로 공개한 것입니다. 원본: https://github.com/kwaroran/RisuAI

---

## English

**A RisuAI file converter.** It unpacks RisuAI modules (.risum) and presets (.risup) into files anyone can read, and exports a module's lorebook and regex scripts for other front ends.

> **Respect creators' rights.** This tool only changes file formats. The text, images and settings inside a module belong to their creator. Convert only modules you made or have the creator's permission to convert.

### Install

Only Node.js 18 or later is needed; there are no dependencies.

```bash
node bin/risu-convert.js --help
```

To use the `risu-convert` command anywhere, run `npm install -g .` in this folder.

### Usage

| Command | What it does |
|---|---|
| `risu-convert unpack module.risum folder` | `module.json` (settings) + `assets/` (images, audio) + `assets.json` (file list) |
| `risu-convert pack folder module.risum` | The reverse; a file saved by RisuAI and left unedited packs back byte-identical |
| `risu-convert preset preset.risup out.json` | A RisuAI preset (.risup or .risupreset) as readable JSON |
| `risu-convert export module.risum folder` | Lorebook and regex scripts for other front ends (an unpacked folder works too) |
| `risu-convert decode·encode in out` | Raw rpack bytes |

There is no file size limit: large modules are read piece by piece, never whole. Truncated or damaged files are reported as errors.

`export` takes `--to sillytavern,card,agnai` (all three by default).

| Target | Files | For |
|---|---|---|
| `sillytavern` | `world_info.json`, `regex/*.json` | SillyTavern World Info and regex import |
| `card` | `character_book.json` | Character Card V3 lorebooks (Chub, RisuAI, …) |
| `agnai` | `memory_book.json` | Agnai memory books |

**Not carried over.** After an export the tool lists what each target lost.
- RisuAI-only triggers (Lua and blocks) and background HTML have no equivalent elsewhere.
- Lorebook folders are only groupings and are dropped; their entries are all kept.
- Translation-stage regex scripts have no SillyTavern stage.
- Regex keys, activation chances, always-active and secondary keys (Agnai) and `@@` decorators inside entries are, depending on the target, not kept or kept only as text.

### As a server

`src/index.js` is a Cloudflare Worker.

| Request | What it does |
|---|---|
| `POST /decode` | rpack bytes in, plain bytes out |
| `POST /encode` | plain bytes in, rpack bytes out |
| `GET /source` | the address of this source code (`SOURCE_URL` in `wrangler.jsonc`) |

Bodies are converted as they stream, with no size cap and flat memory use; one request is bounded only by your Cloudflare plan's request size limit (100 MB on most plans). Every byte is mapped on its own, so larger files can be sent in pieces and the results joined.

Deploying needs a Cloudflare account and [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (use the Node.js version Wrangler requires).

```bash
npx wrangler login
npx wrangler deploy
```

As configured its public address is off (`workers_dev: false`). Set `workers_dev` to `true` to serve it publicly. If you run a modified version as a service, point `SOURCE_URL` at that version's source (AGPL-3.0 section 13).

### In a browser

`browser/rpack-worker.js` is a Web Worker that does rpack conversion in the browser. Given a `{ id, operation: "decode" | "encode", bytes }` message it answers `{ id, bytes }` (or `{ id, error }`). Conversion happens right in the browser, so large modules are fast. This file is the worker's complete source, under AGPL-3.0.

### License

AGPL-3.0-only. The rpack byte map comes from RisuAI (kwaroran and contributors), which publishes it under AGPL-3.0 for use outside Risuai. Original: https://github.com/kwaroran/RisuAI
