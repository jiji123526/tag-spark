# TagSpark 포트폴리오 페이지 — 수정 위치 상세 가이드

> 대상 저장소: [https://github.com/jiji123526/portfolio](https://github.com/jiji123526/portfolio) 목적: 이번 세션 산출물(임베딩 지도·콜드스타트·무드 슬라이더·개인화·검증 로드맵)을 포트폴리오 페이지에 반영할 때 **어느 파일의 어디를, 어떤 코드로** 고치는지 정리. 작성 기준: main 브랜치 현재 상태 (2026-09-22 확인). 관련 산출물: `artifacts/embedding_page_plan.md`, `artifacts/tag-spark_README.md`, `artifacts/tagspark_portfolio_case_study.md`.

---

## 0. 문제 재정의 (⚠️ 반영 필수)

**정정:** 이 프로젝트의 진짜 문제는 "태그로 어떻게 추천하나"가 아니다. 원래 플랫폼(포스타입 등 웹소설 연재처)이 **세밀한 태그를 지원하지 않아, 큐레이션된 작품 리스트를 만들 방법 자체가 없었다.** 그래서 Jiwoo가 **태그 체계(taxonomy)를 처음부터 직접 설계**하고 작품에 부여했다.

**확정된 사실 (사용자 확인):**

- 원 플랫폼에는 **태그가 아예 없었다** (거친 장르 분류조차 없음).
- Jiwoo가 **229개 작품을 전부 직접 읽고**, 반복되는 패턴에서 태그를 귀납적으로 도출했다 (하향식 사전 정의가 아니라 코퍼스에서 상향식으로).
- **229개 작품 전부에 직접 태그를 부여했다** (전수 어노테이션, 부분 샘플 아님).

즉 핵심 기여는 알고리즘이 아니라 **from-scratch 언어 데이터 구축**이다:

1. **코퍼스 정독** — 229개 작품을 전부 읽음 (스키마의 근거).
2. **스키마 귀납적 도출** — 반복 패턴에서 9개 카테고리(분위기·관계·설정·세계관· 장르·분량·완결여부·씨피고정·시스템), 76개 태그, alias 집합을 정의.
3. **전수 어노테이션** — 229개 작품 전부에 직접 태그 부여.
4. 그 위에 추천/정규화/스코어링을 얹음.

**페이지 반영 원칙:** PRODUCT 섹션의 문제 정의를 "주관적 태그를 다루기"에서 **"빈약한 메타데이터 환경에서 taxonomy와 큐레이션 데이터셋을 처음부터 구축하기"**로 바로잡는다. 이는 Language Engineer JD의 *dataset construction, semantic schemas, annotation guidelines*와 직접 대응하며, 기존 "태그 기반 추천기" 프레이밍보다 강하다.

### PRODUCT 섹션 카피 초안 (`tagspark-problem`)

```
eyebrow: PRODUCT CONTEXT
h2: The platform had no tags at all. So I read every work and built the taxonomy.

The source platform offered no tagging whatsoever, so there was no way to curate
"works that feel like this." I read all 229 works, derived a tag taxonomy
inductively from the recurring patterns I saw — 9 categories, 76 tags with alias
sets — and hand-annotated every work in the catalog. Only then does
recommendation become possible: alias normalization, a curated similarity
thesaurus, and layered weighted scoring sit on top of that hand-built dataset.

(problem statement) How do you build a controllable recommendation signal when
the source platform provides no usable metadata to begin with?

```

이 프레이밍은 이후 모든 Phase 1/2 섹션의 전제가 된다 — "먼저 데이터셋을 만들었고, 그 위에 시스템을 얹었다."

---

## 1. 파일 전체 지도

| 파일 | 역할 | 수정 |
| --- | --- | --- |
| `components/tagspark-case-content.tsx` | **케이스 페이지 본문(핵심)** — 모든 섹션 JSX | ⭐ 주 편집 |
| `components/tagspark-section-nav.tsx` | 섹션 네비게이션 배열 | ⭐ id 동기화 |
| `components/tagspark-preference-media.tsx` | include/exclude 데모 미디어 | 무드 슬라이더 데모 후보 |
| `components/tagspark-ranking-media.tsx` | 랭킹/스코어 데모 미디어 | 관련작·이웃 데모 후보 |
| `components/tagspark-ambient-thumbnail.tsx` | 썸네일 배경 | 보통 수정 불필요 |
| `components/TagSparkThumbnailScreen.tsx` `.module.css` | 작업 인덱스 썸네일 | 보통 수정 불필요 |
| `app/work/[slug]/page.tsx` | 케이스 라우팅/렌더 (3개 프로젝트 공용) | 섹션 추가만이면 불필요 |
| `docs/tagspark_portfolio/case_study_language_engineer.md` | 서술 원문(md) | ⭐ 로드맵 서술 보강 |
| `docs/tagspark_portfolio/cluster_thesaurus_db_design.md` | thesaurus→DB 설계 | 이미 존재, 근거 |
| `docs/tagspark_portfolio/ui_and_interactive_guide.md` | UI/인터랙션 가이드 | 데모 추가 시 갱신 |

**핵심:** 실제 렌더되는 페이지 본문은 `tagspark-case-content.tsx` 하나. `docs/*.md`는 서술/설계 노트이고 페이지에 직접 렌더되지 않는다.

---

## 2. ⚠️ nav ↔ content id 불일치 (수정 전 반드시 확인)

`section-nav.tsx`의 섹션 id와 `case-content.tsx`의 실제 id가 다르다. 새 섹션 추가 전에 이 불일치를 정리해야 nav가 정상 작동한다.

### section-nav.tsx가 기대하는 id (10개)

| id | 라벨 | 본문 존재? |
| --- | --- | --- |
| `tagspark-problem` | PRODUCT | ✅ |
| `tagspark-control` | INPUT | ✅ |
| `tagspark-baseline` | BASELINE | ❌ (본문은 normalization/thesaurus/scoring로 분리됨) |
| `tagspark-operations` | DATA | ✅ |
| `tagspark-phase-two` | PHASE 2 | ❌ 신규 |
| `tagspark-model` | MODEL | ❌ 신규 |
| `tagspark-axes` | AXES | ❌ 신규 |
| `tagspark-experience` | EXPERIENCE | ❌ 신규 |
| `tagspark-validation` | VALIDATION | ❌ 신규 |
| `tagspark-roadmap` | ROADMAP | ❌ 신규 |

### case-content.tsx에 실제 존재하는 id (8개)

| id | eyebrow |
| --- | --- |
| `tagspark-problem` | PRODUCT CONTEXT |
| `tagspark-control` | 01 · EXPLICIT PREFERENCE CONTROL |
| `tagspark-normalization` | 02 · ALIAS NORMALIZATION |
| `tagspark-thesaurus` | 03 · CURATED SIMILARITY GRAPH |
| `tagspark-scoring` | 04 · LAYERED ADDITIVE SCORING |
| `tagspark-results` | 05 · RESULT MODEL |
| `tagspark-operations` | 06 · CATALOG + OPERATIONS |
| `tagspark-tagging` | PLANNED EXPERIMENT · REVIEWED TAGGING |
| `tagspark-takeaways` | LIMITATIONS + NEXT STEPS |

### 정리 방침 (권장)

두 파일의 id를 **하나의 최종 목록**으로 맞춘다. 권장 최종 순서(Phase 구조 반영):

```
tagspark-problem        PRODUCT      (Phase 1)
tagspark-control        INPUT        (Phase 1) 01
tagspark-normalization  NORMALIZE    (Phase 1) 02
tagspark-thesaurus      THESAURUS    (Phase 1) 03
tagspark-scoring        SCORING      (Phase 1) 04
tagspark-results        RESULTS      (Phase 1) 05
tagspark-operations     DATA         (Phase 1) 06
tagspark-phase-two      PHASE 2      (구분 헤더)
tagspark-axes           AXES         (Phase 2) 07
tagspark-experience     EXPERIENCE   (Phase 2) 08
tagspark-model          MODEL        (Phase 2) 09
tagspark-validation     VALIDATION   (Phase 2) 10
tagspark-roadmap        ROADMAP      (Phase 2) 11

```

`tagspark-tagging`은 `tagspark-validation`에 흡수하거나 별도 유지 중 택1. `tagspark-takeaways`는 마지막(로드맵 뒤)에 그대로 둔다.

---

## 3. 세션 작업 → Phase / 섹션 매핑

`tag-spark_README.md`의 Phase 구조와 정렬:

### Phase 1 — 현재 프로덕션 (이미 페이지에 있음, 카피 다듬기만)

| README | 페이지 섹션 | 상태 |
| --- | --- | --- |
| 1-1 Explicit preference control | `tagspark-control` | 존재 |
| 1-2 Alias normalization | `tagspark-normalization` | 존재 |
| 1-3 Hand-built thesaurus | `tagspark-thesaurus` | 존재 |
| 1-4 Hierarchical scoring | `tagspark-scoring` | 존재 |
| 1-5 Catalog + operations | `tagspark-operations` | 존재 |

### Phase 2 — 추가 계획 (신규 섹션 작성)

| README | 신규 섹션 id | eyebrow 후보 | 근거 (embedding_page_plan.md) |
| --- | --- | --- | --- |
| 2-1 Thesaurus→data | `tagspark-phase-two` (헤더) | PHASE 2 | 부록 B / 1장 |
| 2-2 Multi-axis mood | `tagspark-axes` | 07 · MOOD AXES | 2·3·9·10장 |
| 2-3 Desktop map / mobile | `tagspark-experience` | 08 · PLATFORM | 11·13장 |
| 2-4 Cold start | `tagspark-experience` 내 | (동일) | 12장 |
| 2-5 Personalization | `tagspark-model` | 09 · PERSONALIZATION | 12장 |
| 2-6 Validation | `tagspark-validation` | 10 · VALIDATION | 5·6장, FicSim |
| 2-7 Learned similarity | `tagspark-model` 내 | (동일) | 14장, 부록 B |

---

## 3.5. 페이지 4막 구조 (PROBLEM → PHASE 1 → PHASE 2 → TAKEAWAY)

페이지 전체를 4막 서사로 재배치한다. 스크롤 진행이 곧 이야기가 되도록.

### 최종 섹션 순서 (12개)

```
── ACT 1: PROBLEM ──
PRODUCT        tagspark-problem      태그가 없어 큐레이션이 불가능했다

── ACT 2: PHASE 1 (shipped) ──
DATASET        tagspark-dataset      ⭐신규: 229개 정독→귀납적 스키마→전수 어노테이션
INPUT          tagspark-control      명시적 선호 통제
NORMALIZE      tagspark-normalization alias 정규화
THESAURUS      tagspark-thesaurus    수작업 유사도 그래프
SCORING        tagspark-scoring      계층적 가중 스코어링
DATA           tagspark-operations   카탈로그·운영

── ACT 3: PHASE 2 (planned) ──
PHASE 2        tagspark-phase-two    전환 헤더 ("여기부터 계획")
AXES           tagspark-axes         다축 무드 공간
EXPERIENCE     tagspark-experience   데스크톱 지도/모바일 + 콜드스타트
MODEL          tagspark-model        개인화 + learned similarity
VALIDATION     tagspark-validation   쌍 비교·IAA·FicSim

── ACT 4: TAKEAWAY ──
TAKEAWAY       tagspark-takeaways    추천기는 그 아래 데이터만큼만 신뢰할 수 있다

```

### 각 막이 증명하는 것

| 막 | 한 문장 주제 | 증명 역량 |
| --- | --- | --- |
| PROBLEM | 태그가 없어 큐레이션이 불가능했다 | 문제 인식 |
| PHASE 1 | 데이터셋을 만들고 규칙 기반 추천을 얹었다 | 데이터 구축 + 구현 |
| PHASE 2 | 해석 가능성을 유지하며 데이터·학습으로 확장한다 | 비전 + 방법론 |
| TAKEAWAY | 추천기는 그 아래 데이터만큼만 신뢰할 수 있다 | 성숙한 판단 |

### 핵심 배치 결정

1. **DATASET을 독립 섹션으로 분리** (PROBLEM에서 빼냄). PROBLEM은 "왜"(태그 없음), DATASET은 "무엇을 했나"(정독·귀납적 스키마·전수 어노테이션). Jiwoo의 가장 강력한 Language Engineer 증거이므로 묻히면 안 된다. Phase 1의 **첫 섹션**으로 두어 "먼저 데이터를 만들었다" 전제를 세운다.
2. **PROBLEM은 문제만.** 태그 전무 → 큐레이션 불가라는 상황과 질문("빈약한 메타데이터에서 통제 가능한 추천 신호를 어떻게?")까지만.
3. **PHASE 2 전환 헤더로 경계 명시.** 채용 담당자가 "지금 것 vs 계획"을 한눈에.
4. **TAKEAWAY는 마지막 정리.** 기존 takeaways 유지, nav 라벨만 TAKEAWAY.

### DATASET 섹션 카피 초안 (`tagspark-dataset`, Phase 1 첫 섹션)

```tsx
<section className="tagspark-feature shell case-section" id="tagspark-dataset">
  <div className="tagspark-feature-copy">
    <p className="eyebrow">01 · DATASET FROM SCRATCH</p>
    <h2>No tags existed, so I read every work and built the dataset.</h2>
    <p>
      The source platform had no tagging at all. I read all 229 works, derived a
      tag taxonomy inductively from the recurring patterns — 9 categories, 76
      tags with alias sets — and hand-annotated every work. This full-coverage,
      from-scratch language dataset is the foundation everything else sits on.
    </p>
    <div className="tagspark-language-flow" aria-label="Dataset construction flow">
      <span>read 229 works</span>
      <i>→</i>
      <span>induce schema</span>
      <i>→</i>
      <span>annotate all</span>
    </div>
  </div>
  <TagSparkPlaceholder
    label="Taxonomy: 9 categories · 76 tags"
    note="FULL-COVERAGE HAND ANNOTATION (229 WORKS)"
  />
</section>

```

주의: DATASET이 01이 되면 기존 INPUT(01) 이하 eyebrow 번호가 한 칸씩 밀린다 (INPUT 02, NORMALIZE 03 …). 4장의 신규 Phase 2 섹션 번호도 이에 맞춰 재계산할 것.

### nav 배열 최종본 (4막 반영)

```tsx
const sections = [
  { id: 'tagspark-problem', label: 'PROBLEM' },
  { id: 'tagspark-dataset', label: 'DATASET' },
  { id: 'tagspark-control', label: 'INPUT' },
  { id: 'tagspark-normalization', label: 'NORMALIZE' },
  { id: 'tagspark-thesaurus', label: 'THESAURUS' },
  { id: 'tagspark-scoring', label: 'SCORING' },
  { id: 'tagspark-operations', label: 'DATA' },
  { id: 'tagspark-phase-two', label: 'PHASE 2' },
  { id: 'tagspark-axes', label: 'AXES' },
  { id: 'tagspark-experience', label: 'EXPERIENCE' },
  { id: 'tagspark-model', label: 'MODEL' },
  { id: 'tagspark-validation', label: 'VALIDATION' },
  { id: 'tagspark-takeaways', label: 'TAKEAWAY' },
] as const;

```

### (선택) Phase 1 압축안

Phase 1이 6개라 길면 NORMALIZE+THESAURUS+SCORING을 "ENGINE" 한 섹션으로 묶어 4개로 줄일 수 있다. 깊이(개별 기법 노출) vs 간결의 트레이드오프 — 개별 유지가 기술 깊이를 더 잘 보여주므로 기본은 분리 유지 권장.

---

## 4. 편집 절차

### 4-A. Phase 2 구분 헤더 추가

`tagspark-operations`(06) 섹션 뒤, 첫 Phase 2 섹션 앞에 삽입:

```tsx
<section className="shell case-section" id="tagspark-phase-two">
  <p className="eyebrow">PHASE 2 · PLANNED</p>
  <h2>From a rule-based baseline toward a data-driven mood space.</h2>
  <p>
    The following are designed, not yet shipped. They extend the interpretable
    baseline above into a data-backed, eventually learned system without losing
    interpretability.
  </p>
</section>

```

### 4-B. AXES 섹션 (2-2 다축 무드 공간)

`tagspark-phase-two` 뒤 삽입. 기존 feature 섹션 패턴 사용:

```tsx
<section className="tagspark-feature shell case-section" id="tagspark-axes">
  <div className="tagspark-feature-copy">
    <p className="eyebrow">07 · MOOD AXES</p>
    <h2>Continuous mood becomes a navigable space.</h2>
    <p>
      Tags are treated by measurement type. Continuous moods become spatial
      axes: <strong>darkness</strong> (healing/sweet to bleak/sad/bittersweet,
      validated on real data) and <strong>relational tension</strong> (sweet to
      antagonistic). The two are only weakly correlated (about −0.31), so they
      are effectively independent. Binary tags (school setting, completion)
      become filters; nominal tags (genre, worldview) become color.
    </p>
    <div className="tagspark-language-flow" aria-label="Dimension split">
      <span>continuous → axes</span>
      <i>·</i>
      <span>binary → filters</span>
      <i>·</i>
      <span>nominal → color</span>
    </div>
  </div>
  <TagSparkPlaceholder
    label="Mood-space scatter (darkness × tension)"
    note="DESKTOP MAP · MOBILE = SLIDERS + LIST"
  />
</section>

```

근거·수치: 어두움 축 검증 범위 −3.6~+2.0, 축 상관 −0.31 (embedding_page_plan.md 3·9장). VAD / Power–Danger / FicSim 근거는 부록 B.

### 4-C. EXPERIENCE 섹션 (2-3 플랫폼 소비 + 2-4 콜드스타트)

```tsx
<section className="tagspark-feature shell case-section" id="tagspark-experience">
  <div className="tagspark-feature-copy">
    <p className="eyebrow">08 · PLATFORM-AWARE EXPERIENCE</p>
    <h2>Desktop map, mobile list — one embedding, two surfaces.</h2>
    <p>
      The embedding's value is <em>distance</em>, not showing every point at
      once. Desktop gets a 2D exploration map; mobile (primary) gets mood
      sliders that filter into a ranked list plus a "similar works" list,
      avoiding small-screen overplotting. The embedding is a cross-platform
      recommendation signal, improving quality even where the map isn't shown.
    </p>
    <p>
      For new visitors, cold start uses preference elicitation: pick a few
      favorites from a popular-works list, aggregate their tags into a taste
      starting point. Content-based tags let the first recommendation work with
      zero behavioral data.
    </p>
  </div>
  <TagSparkPlaceholder
    label="Mobile mood sliders → ranked list"
    note="COLD START · PICK FAVORITES → TASTE SEED"
  />
</section>

```

근거: embedding_page_plan.md 11·12·13·14장.

### 4-D. MODEL 섹션 (2-5 개인화 + 2-7 learned similarity)

```tsx
<section className="tagspark-feature shell case-section" id="tagspark-model">
  <div className="tagspark-feature-copy">
    <p className="eyebrow">09 · PERSONALIZATION + LEARNED SIGNAL</p>
    <h2>Explicit signals first, learned similarity as augmentation.</h2>
    <p>
      Taste is learned from explicit signals — "more like this" and "not for
      me" — preferred over reading history ("read ≠ liked"). A mood slider lets
      users steer darkness/tension directly. Taste persists via a signed
      anonymous token, not IP or fingerprint. Later, tag co-occurrence and
      embedding cosine are computed offline and written as
      <code>source='embedding'</code> edges, with curated edges kept as an
      interpretable backbone.
    </p>
  </div>
  <TagSparkPlaceholder
    label="more like this / not for me"
    note="EXPLICIT SIGNAL > IMPLICIT HISTORY"
  />
</section>

```

근거: embedding_page_plan.md 12·14장.

### 4-E. VALIDATION 섹션 (2-6)

```tsx
<section className="shell case-section" id="tagspark-validation">
  <p className="eyebrow">10 · VALIDATION</p>
  <h2>Making subjective tags measurable.</h2>
  <p>
    Collect pairwise comparisons ("is A darker than B?") from a small trusted
    group with overlap, verify reliability with inter-annotator agreement
    (IAA — Cohen's / Krippendorff), then learn tag weights via
    Bradley-Terry / logistic regression. Validate with an A/B test once there
    is user traffic. This mirrors CMU's FicSim: derive similarity from tags,
    validate with triplet comparisons and Cohen's Kappa.
  </p>
</section>

```

근거: embedding_page_plan.md 5·6장, 부록 B(FicSim).

### 4-F. ROADMAP 섹션 재구성 (기존 takeaways와 연결)

기존 `tagspark-takeaways`(LIMITATIONS + NEXT STEPS)를 유지하되, Phase 2 흐름의 마지막 정리로 배치. 또는 `tagspark-roadmap` id로 Phase 1→2 한눈 요약 표를 추가.

### 4-G. section-nav 동기화 (`tagspark-section-nav.tsx`)

`sections` 배열을 2장의 최종 목록과 일치시킨다. 예:

```tsx
const sections = [
  { id: 'tagspark-problem', label: 'PRODUCT' },
  { id: 'tagspark-control', label: 'INPUT' },
  { id: 'tagspark-normalization', label: 'NORMALIZE' },
  { id: 'tagspark-thesaurus', label: 'THESAURUS' },
  { id: 'tagspark-scoring', label: 'SCORING' },
  { id: 'tagspark-operations', label: 'DATA' },
  { id: 'tagspark-phase-two', label: 'PHASE 2' },
  { id: 'tagspark-axes', label: 'AXES' },
  { id: 'tagspark-experience', label: 'EXPERIENCE' },
  { id: 'tagspark-model', label: 'MODEL' },
  { id: 'tagspark-validation', label: 'VALIDATION' },
  { id: 'tagspark-takeaways', label: 'ROADMAP' },
] as const;

```

**규칙:** nav 배열의 모든 id는 본문에 실제 섹션이 있어야 한다 (없으면 클릭 시 무동작). 본문 추가와 nav 수정을 같은 커밋에서 함께 한다.

### 4-H. 서술 원문 (`docs/tagspark_portfolio/case_study_language_engineer.md`)

기존 `## WHAT I'D IMPROVE NEXT`(01~05 엔지니어링 hardening)은 유지. 그 아래 **제품 방향 로드맵**을 별도 층으로 추가 (Phase 2 항목 서술). 이 md는 페이지에 직접 렌더되지 않으므로 근거/서술 보관용. `tag-spark_README.md`의 Phase 2 영문 문구를 재사용하면 일관성이 유지된다.

---

### 4-I. 구현 상세 (섹션 본문·데모에 담을 메커니즘)

각 Phase 2 섹션이 "무엇을·왜"만 말하지 않고 **"어떻게"**까지 보여주도록, 설계 문서(`embedding_page_plan.md` §14)의 구현 내용을 섹션별로 매핑한다. 카피나 데모 캡션에 아래 메커니즘을 녹인다.

AXES 섹션에 담을 구현

- **작품 벡터 이원화:** 태그 TF-IDF 벡터(76차원, 추천용) + 축 좌표(2D, 지도용)를 동시에 유지. `work_vector[tag] = weight × IDF(tag)`, `IDF = log(N / 태그보유작품수)`.
- **축 좌표:** `darkness = Σ weight·s_dark`, `tension = Σ weight·s_tension`.
- 캡션 예: "76-dim tag vector for ranking · 2D coords for the map."

EXPERIENCE 섹션에 담을 구현 (콜드스타트 흐름)

6단계를 캡션/다이어그램으로:

```
인기작 그리드(다양성 고려) → 3~5개 좋아요 선택 → 취향 시드 계산
   (추천용: 태그 집계=taste_vector / 시각화용: 좌표 평균=taste_point)
→ 콘텐츠 기반 첫 추천(데이터 0에서도) → 무드 슬라이더 조정 → more like this 점진 학습

```

- 취향 시드 **이원화 근거:** 태그 집계는 다봉 취향("어두움+밝음 둘 다") 보존 → 추천 정확 / 좌표 평균은 지도에 "당신은 여기" 한 점. (시연: 두 방식 추천이 전혀 안 겹침, 좌표 평균은 중간으로 뭉갬.)
- "지도=데스크톱 / 신호=전 플랫폼" 분리(§13)를 캡션에 명시.

MODEL 섹션에 담을 구현 (reco.ts 통합 + 개인화)

- **additive 레이어:** 기존 계층 스코어링에 embedding 레이어(w5)를 더한다.

```
score = w1·exact + w2·alias + w3·same_cat + w4·cluster + w5·embedding
      ; 전체 ÷ sqrt(tag_count)

```

- w5는 0에서 시작(동작 보존) → tag_similarity 시드 검증 후 점진 상향. parity 체크.
- **more like this:** 작품 벡터 코사인 top-K → 리스트. "관심 없음"은 그 방향 downweight (쿼리 벡터에서 빼거나 제외 집합).
- **명시적 > 암묵적:** more like this / not for me 우선, 열람 기록("읽음≠좋음") 후순위.
- **익명 토큰:** IP/fingerprint 아닌 서명 토큰(yap. 재사용)에 취향 축적.

VALIDATION 섹션에 담을 구현

- 쌍 비교("A가 B보다 어두운가") → IAA(Cohen's/Krippendorff)로 신뢰도 → Bradley-Terry/로지스틱 회귀로 태그 가중치 학습 → 유저 확보 후 A/B.
- FicSim 방법론과 동일(태그에서 유사도, triplet + Cohen's Kappa)임을 명시.

구현 순서 (섹션 서술의 "지금 vs 나중" 근거)

| 기능 | 필요 조건 | 시점 |
| --- | --- | --- |
| more like this / 이웃 | 태그 벡터만 | 지금 |
| 콜드스타트(선택→집계) | 태그 벡터 + 인기작 | 지금 |
| reco.ts embedding 레이어 | tag_similarity 시드 | Phase 2 초 |
| 무드 슬라이더 | 축 좌표 | Phase 2 |
| 익명 토큰 개인화 | 서명 토큰 인프라 | Phase 2 |
| 학습된 가중치 | 쌍 비교 + Bradley-Terry | Phase 2 후 |

이 표의 "지금 가능" 항목(more like this, 콜드스타트)은 MVP로 먼저 만들 수 있어, 포트폴리오에서 "설계만"이 아니라 "일부는 바로 구현 가능"임을 보여준다.

---

## 5. 데모 미디어 (선택)

| 데모 | 참고 컴포넌트 | 넣을 섹션 |
| --- | --- | --- |
| 무드 슬라이더 (darkness × tension) | `tagspark-preference-media.tsx` 패턴 | AXES / EXPERIENCE |
| 관련작·이웃 top-K 리스트 | `tagspark-ranking-media.tsx` 패턴 | MODEL |
| 어두움 축 산점도 | 신규 (2D scatter) | AXES |

데모 없이 텍스트+`TagSparkPlaceholder`만으로도 섹션은 성립 (MVP는 텍스트 우선). `TagSparkPlaceholder`는 case-content.tsx에 이미 정의된 로컬 컴포넌트 (label, note props).

---

## 6. 근거 자료 위치 (세션 산출물)

- `artifacts/embedding_page_plan.md` — 14장+부록. 각 섹션 근거:- 2장 차원 아키텍처 → AXES
- 3·9·10장 축 설계/확정 → AXES
- 2.3 문학축 커버리지(요약 불필요, Style=author) → MODEL/DATASET
- 11·13장 모바일/데스크톱 → EXPERIENCE
- 12장 개인화 로드맵 → MODEL/EXPERIENCE
- 5·6장 + 부록 B → VALIDATION
- `artifacts/tag-spark_README.md` — Phase 1/2 영문 문구 (섹션 카피 재사용).
- `artifacts/tagspark_portfolio_case_study.md` — 영문 pitch (카피 초안).

---

## 7. 체크리스트 (커밋 전)

- [ ] 신규 섹션 id가 nav 배열과 정확히 일치하는가
- [ ] eyebrow 번호가 06 다음부터 연속(07·08…)인가
- [ ] Phase 2 섹션이 "shipped 아님/계획"임을 문구로 명시했는가 (정직성)
- [ ] 수치(축 상관 −0.31, 어두움 범위)와 근거(FicSim/VAD)가 embedding_page_plan.md와 일치하는가
- [ ] 기존 정직성 노트(수작업 클러스터·고정 가중치 = rule-based baseline) 유지했는가
- [ ] nav 수정과 본문 추가를 같은 커밋에 넣었는가
- [ ] takeaways/roadmap 마지막 위치 유지했는가

---

## 8. 한 줄 결론

**실제 편집 = `tagspark-case-content.tsx`에 Phase 2 신규 섹션(PHASE 2 헤더 + AXES

- EXPERIENCE + MODEL + VALIDATION) 추가 + `tagspark-section-nav.tsx` id 동기화.** Phase 1(현재 프로덕션)은 이미 있으니 카피만 다듬고, Phase 2는 nav가 예약해 둔 빈 섹션(axes/model/phase-two/validation/roadmap)을 이번 세션 근거로 채운다. 서술 원문은 `docs/tagspark_portfolio/case_study_language_engineer.md`에 보강한다.

