# TagSpark 케이스 스터디 — 주관적 태그를 측정 가능한 다축 임베딩으로

> Language Engineer / ML Data 직무 지원용 포트폴리오 서사. 웹소설 추천 플랫폼 TagSpark에서, "사람의 느낌"에 기반한 주관적 태그를 해석 가능하고 측정 가능한 다축 시스템으로 발전시킨 과정. 영문 인터뷰용 요약은 문서 하단 "English Pitch" 참고.

---

## 1. 한 문장 요약 (Elevator pitch)

하드코딩된 태그 유사도 규칙을, 사람이 검증할 수 있는 데이터 기반 다축 임베딩 공간으로 발전시켰다 — 감정 컴퓨팅의 표준 프레임워크(Valence–Arousal–Dominance, 소설 특화 Power–Danger)와 CMU FicSim의 태그 기반 유사도 방법론에 근거해, 해석 가능성을 잃지 않으면서 확장 가능한 시스템을 설계했다.

---

## 2. 문제 (Problem)

TagSpark의 추천 엔진(`src/lib/reco.ts`)은 태그 유사도를 코드에 하드코딩했다:

- 약 15개 클러스터를 **이름(name) 기준**으로 묶고, 모든 클러스터 내 쌍에 **단일 전역 가중치 0.6**을 부여.
- 새 관계마다 코드 수정 + 재배포 필요. 관계별 가중치 표현 불가. 그래프가 코드에 묻혀 있어 편집·조회·재사용 불가.

더 근본적인 문제: 태그가 **사람의 주관적 느낌**("부부↔이혼"이 "부부↔육아"보다 가깝다)에 기반하는데, 이를 검증할 **객관적 정답(ground truth)이 없었다.**

---

## 3. 접근의 진화 (Interpretable → Data-driven → Learned)

이 프로젝트의 핵심 서사는 교과서적 진행 단계를 실제로 밟은 것이다.

### 3.1 하드코딩 → 데이터 (thesaurus 마이그레이션)

- 코드의 클러스터를 **id 기반 엣지 테이블**(`tag_similarity`)로 이전.
- 설계 원칙: id 기반(rename-safe), 정규 순서(a<b)로 무방향 쌍 1회 저장, 엣지별 가중치, `source` 컬럼(curated/derived/embedding 공존).
- weight 0.6으로 시드해 **기존 동작을 정확히 보존**(behavior-preserving swap), 회귀 동등성 확인 후 하드코딩 제거 — 되돌릴 수 있는 안전한 롤아웃.

### 3.2 "사람 느낌"을 측정 가능하게 만들기

주관성이 핵심 도전이었다. 접근:

- **절대 점수 대신 쌍/삼중 비교** ("A가 B보다 어두운가?") — 사람은 절대 점수보다 상대 비교를 훨씬 일관되게 답한다.
- **어노테이터 간 일치도(IAA)**로 신뢰도 검증 — Cohen's/Fleiss' Kappa, Krippendorff's Alpha. 합의가 높은 쌍만 gold standard로.
- 자동 계산(임베딩)을 사람 정답에 **Spearman 상관, Precision@K**로 평가.

### 3.3 단일 태거 제약과 우회 설계

실제 플로우: 추천자 1명이 작품을 올리면 태그가 자동 확정 → **작품당 태거 1명, 중복 없음.** 표준 IAA와 잠재 신뢰도 모델(Dawid-Skene 등)은 중복 태깅이 있어야 작동하므로 **지금 데이터로는 불가.**

- 우회: **텍스트/요약을 유일한 심판**으로 삼는 정합성 검증을 먼저 세움.
- 향후: 소수 신뢰 그룹(3~5명)이 일부 작품을 겹쳐 태깅 → IAA·신뢰도 모델 개방.
- 제약을 인식하고 우회 설계를 제안하는 것 자체가 성숙한 ML 데이터 엔지니어링.

---

## 4. 핵심 설계 결정 — 다축 임베딩 지도

### 4.1 차원을 3층으로 분리 (이 프로젝트의 핵심 통찰)

모든 태그를 동일하게 벡터화하지 않았다. **측정 성격**에 따라 나눔:

| 유형 | 성격 | 예시 | 표현 |
| --- | --- | --- | --- |
| 연속 (비교 가능) | 정도 차이 | 분위기(어두움) | 공간 축 |
| 이진 (범주형) | 있다/없다 | 청레(학원물), 완결 | 필터 토글 |
| 명목 (다중 범주) | 여럿 중 하나 | 장르, 세계관 | 색상/모양 |

화면 축은 **2~3개로 제한** (사람 인지 한계). 나머지는 색·필터로.

### 4.2 실측 근거

- 데이터: 작품 229개, 태그 76개, 9개 카테고리, work_tags 1,630개.
- **어두움 축 검증 완료:** 힐링·달달(+) ↔ 피폐·새드·찌통(−), 범위 −3.2~+2.8. 가장 어두움 「낮은 밤」, 가장 밝음 「시고르자브종」 — 사람이 봐도 타당.
- **76차원 통짜 PCA는 분산 11.9%만 설명** → 선형 투영 부적합을 실측으로 확인, 해석 가능한 소수 축 전략의 근거로 삼음.

### 4.3 의미로 판단, 상관으로 판단하지 않음

모호 태그의 의미를 확정해 축 배치를 교정한 사례:

- "노딱(성인물)"은 어두운 작품과 자주 **동시출현**했지만, 성인물이라는 속성 자체는 어두움과 무관 → 어두움 축에서 제외, 필터로.
- 교훈: **동시출현(상관)이 아니라 태그의 의미(semantic)로 축을 정한다.**

### 4.4 프로덕션 제약 — 모바일 우선 설계

TagSpark은 모바일 우선 서비스다. 작은 화면에 수백 개 점을 뿌리면 오버플로팅으로 무너진다. 시각화 연구와 음악 무드 지도 서비스(Moodify 등)를 조사해 제약에 맞는 설계로 재프레이밍:

- **임베딩의 가치는 "거리(유사도)"이지 "모든 점을 한 화면에 표시"가 아니다.**
- 모바일: "어두움" · "관계 긴장" 슬라이더로 영역을 좁혀 **작품 리스트**로, 또는 클러스터 버블 + 시맨틱 줌으로 요약.
- 데스크톱: 자유로운 2D 산점도(WebGL)를 보너스 뷰로.
- 지도가 아니라 **"이 작품과 비슷한 작품 리스트"**가 모바일에선 임베딩의 가장 자연스러운 소비 형태.
- 교훈: 멋진 시각화보다 **실제 사용 맥락(모바일)에 맞는 표현**을 우선한다.

### 4.5 축 결정 과정 — 직관을 데이터로 교정 (확정: Forward 어두움 × 긴장)

축을 고르는 과정에서 직관을 데이터로 두 번 교정했다:

1. **"어두움 × 친밀도" 직관 → 데이터로 뒤집힘.** 로맨스라 친밀도가 좋겠다 싶었으나, 4분면 분포를 보니 친밀도−(정략결혼류)가 희귀해 쏠림(7/54). 어두움 × 권력차가 더 균형(20/47)이었다.
2. **"어두움이 주축" 가정 → PCA로 재검토.** 태그 PCA에서 어두움은 PC4였고 상위 축은 배경·관계·씨피고정이었다 (명목/필터로 밀어낸 것이 강한 축으로 emerge).

로맨스 도메인이라 관계 역학 축(친밀도·권력차)이 무드 축과 **−0.11~+0.01로 독립** 임도 확인했다.

**확정:** 여러 후보(어두움·긴장·친밀도·권력차)를 저울질한 끝에, **Forward 방식으로 어두움 × 긴장 두 축부터 시작**하기로 했다. 실행은 2단계 하이브리드:

- 1단계: 태그 쌍 비교로 가중치 확정 → 작품 사전 배치(pre-map)
- 2단계: pre-map에서 가까운(불확실한) 작품끼리만 쌍 비교로 미세 조정 (능동 샘플링)

**정직한 미결:** 어두움×긴장은 두 축 상관 −0.39로 4분면 쏠림이 있어, 시각화가 목적이면 권력차 축으로 교체·보완할 수 있다. 축은 아직 최종 미결이며, 이 검증 과정 자체가 설계의 핵심이다.

---

## 5. 학술적 근거 (Grounding)

직관을 확립된 연구로 검증한 것이 이 프로젝트의 강점.

- **Valence–Arousal(–Dominance):** 감정 컴퓨팅의 표준 2~3축 모델. 우리의 "어두움 축"이 Valence와 정확히 대응.
- **Ousiometrics (Power–Danger, Dodds et al., Science Advances 2026):** 3만 권 분석 결과 소설 감정은 VAD보다 Power–Danger에 더 잘 맞음 → 우리 어두움 축은 사실 "Danger(위험도)"에 더 가까움.
- **FicSim (Johnson et al., CMU, 2025):** 긴 소설을 12축으로 유사도를 재는 벤치마크. **작가 태그를 gold standard로, 태그를 임베딩해 유사도 계산, triplet 비교 + Cohen's Kappa(0.65)로 검증** — 우리 방법론과 거의 동일. 핵심 결과: 최신 임베딩조차 톤·주제 같은 미세 유사도는 못 잡고 문체 등 표면 특징에 과의존 → **사람 태그를 backbone으로 유지할 근거.**

---

## 6. 축 커버리지 — 기존 데이터로 충분 (텍스트 수집 불필요)

- **태그는 100% 사람이 부여** — 자동 태깅·요약 기반 태그 검증은 하지 않는다. 프로젝트의 핵심 자산이 사람 큐레이션 데이터셋이므로 기계로 희석하지 않는다.
- CMU FicSim의 12개 문학 축을 우리 데이터에 대응시키면 주요 축이 **기존 태그 9개 카테고리 + author 메타데이터로 이미 커버**된다:- Plot → 설정 카테고리(19개: 청레·오피스·연예인·재벌·회귀 등)
- Character States → 분위기(무드), Relationship Dynamics → 관계(16개)
- Time → 설정(시대물)+분위기(계절), Theme → 세계관+관계 일부
- **Style → author 메타데이터** (같은 작가 ≈ 유사 문체, FicSim도 확인)
- **결론:** 요약/본문 임베딩은 순수 추가 가치가 거의 없다 (Plot=설정, Style=author로 이미 대체). "가진 데이터를 최대 활용하고 불필요한 수집을 피한다"는 판단.

---

## 7. 측정 (Evaluation)

| 대상 | 방법 |
| --- | --- |
| 축 타당성 | 축 양 끝 작품을 사람이 검토 동의 (IAA) |
| 이웃 보존 | 2D 이웃이 태그 공간 이웃과 일치 (trustworthiness) |
| 임베딩 vs 사람 | Spearman 상관, Precision@K, NDCG |
| 쌍 비교 재현 | held-out triplet을 복원 좌표가 맞히는지 (Kendall's tau) |

---

## 8. 이력서 역량과의 연결

| 프로젝트 요소 | 이력서/실무 근거 |
| --- | --- |
| 주관적 태그를 일관된 데이터 결정으로 | "translating linguistic edge cases into consistent data decisions" (Amazon) |
| 차원을 feature field로 분리 | "separating fine-grained linguistic distinctions into feature fields" (GOLA.IO) |
| 태그 정규화·alias 처리 | jangoing normalization, annotation conventions |
| IAA·annotation consistency | GOLA.IO "3 stable model-training labels로 consistency 향상" |
| 해석 가능 baseline → 학습 | jangoing "bootstrap corpora", "curated edges as trusted backbone" |
| LLM 생성 평가(요약 검증) | Q-Bank "grammaticality/coherence/ambiguity 평가, error pattern으로 프롬프트 개선" |

---

## 9. English Pitch (인터뷰용)

> TagSpark's recommender hardcoded tag similarity as a single global constant. I moved it to a data-driven, per-edge model, then extended it into a multi-axis embedding map for exploration. The hard part was that the tags are subjective ("does this story feel darker than that one?"), so there was no absolute ground truth. Instead of trusting a single judgment, I used pairwise comparisons and inter-annotator agreement to validate which signals are actually shared, and kept the hand-curated tags as an interpretable backbone. I separated tags by measurement type — continuous (mood → spatial axes), binary (school setting → filters), nominal (genre → color) — and limited the screen to 2–3 axes. I grounded the axes in the Valence–Arousal–Dominance model and the Power–Danger reinterpretation for fiction, and I confirmed my method matched CMU's FicSim: derive similarity from author tags, embed the tags, validate with triplet comparisons and Cohen's Kappa. Because FicSim showed that even modern embeddings miss fine-grained literary similarity and over-index on style, I deliberately kept human tags as the trusted backbone and relied only on existing data — the curated tags plus author metadata as a style proxy — rather than collecting summaries or full text (Plot maps to the setting category, Style to author). Tags stay 100% human-assigned. Because the product is mobile-first, I reframed the map itself: instead of forcing a dense scatterplot onto a small screen, I surface the embedding as mood sliders that filter into a ranked list, and as a "similar works" list, treating the embedding as a distance function rather than a screen-filling picture. On axes, I corrected my own intuition with data twice — a plausible "darkness × intimacy" split was actually unbalanced, and PCA showed darkness wasn't even the top axis — then committed to a forward darkness × tension start validated by pairwise tag comparisons, while honestly leaving the final axis choice open.

---

## 부록 — 정직성 메모

- 어두움 축 가중치는 초기 추정치. 쌍 비교로 검증 전까지 품질 개선을 주장하지 않음.
- 단일 태거 구조에서 신뢰도 모델은 중복 태깅 데이터 확보 후에만 적용 가능.
- 어두움 정밀화는 임베딩이 아니라 쌍 비교가 담당 (FicSim: 임베딩은 톤 유사도를 못 잡음). 태그는 100% 사람 부여, 자동 태깅 없음.

