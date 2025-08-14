export type Tag = {
  id: number;
  name: string;
  category: "설정" | "관계" | "분위기" | "장르" | "세계관" | "분량" | "완결여부";
  aliases?: string[];
};

export const tags: Tag[] = [
  // 설정 (100~199)
  { id: 101, name: "청레", category: "설정", aliases: ["학생", "고등학생", "중학생", "고딩", "중딩", "10대"] },
  { id: 102, name: "캠퍼스", category: "설정", aliases: ["대학", "대학생", "대딩", "20대"] },
  { id: 103, name: "오피스", category: "설정", aliases: ["회사", "직장", "사내연애"] },
  { id: 104, name: "군대", category: "설정", aliases: ["군인", "군바리"] },
  { id: 105, name: "연예인", category: "설정", aliases: ["아이돌", "배우", "앵커", "연습생", "프듀", "래퍼"] },
  { id: 106, name: "메디컬", category: "설정", aliases: ["병원", "의료"] },
  { id: 107, name: "스포츠", category: "설정" },
  { id: 108, name: "조직물", category: "설정", aliases: ["조폭", "마피아"] },
  { id: 109, name: "시대물", category: "설정", aliases: ["과거", "조선", "옛날"] },
  { id: 110, name: "여행", category: "설정" },
  { id: 119, name: "농촌", category: "설정" },
  { id: 111, name: "육아", category: "설정", aliases: ["돌싱", "싱글맘"] },
  { id: 112, name: "종교", category: "설정" },
  { id: 113, name: "연프", category: "설정", aliases: ["연애 프로그램", "티비 프로그램", "프로그램", "예능"] },
  { id: 114, name: "인외", category: "설정", aliases: ["인외존재", "인어", "외계인"] },
  { id: 115, name: "재벌", category: "설정" },
  { id: 116, name: "사제", category: "설정", aliases: ["선생님", "제자", "교수", "학생"] },
  { id: 117, name: "연반", category: "설정" },
  { id: 118, name: "동갑", category: "설정" },

  // 관계 (200~299)
  { id: 201, name: "소꿉친구", category: "관계" },
  { id: 202, name: "선후배", category: "관계" },
  { id: 203, name: "직장동료", category: "관계", aliases: ["사내연애"] },
  { id: 204, name: "부부", category: "관계", aliases: ["기혼"] },
  { id: 205, name: "이혼", category: "관계" },
  { id: 206, name: "정략결혼", category: "관계" },
  { id: 207, name: "친구", category: "관계", aliases: ["친구에서연인으로", "친연"] },
  { id: 208, name: "키잡", category: "관계" },
  { id: 209, name: "역키잡", category: "관계" },
  { id: 210, name: "(짭)근친", category: "관계" },
  { id: 211, name: "쌍둥이", category: "관계" },
  { id: 212, name: "이별", category: "관계" },
  { id: 214, name: "칼짝윈", category: "관계", aliases: ["짝사랑"] },
  { id: 215, name: "윈짝칼", category: "관계", aliases: ["짝사랑"] },
  { id: 216, name: "재회", category: "관계" },

  // 분위기 (300~399)
  { id: 301, name: "로코", category: "분위기", aliases: ["로맨틱 코미디"] },
  { id: 302, name: "힐링", category: "분위기", aliases: ["치유", "따뜻함"] },
  { id: 303, name: "달달", category: "분위기", aliases: ["달달물"] },
  { id: 304, name: "풋풋", category: "분위기" },
  { id: 305, name: "찌통", category: "분위기", aliases: ["짠내", "애절"] },
  { id: 306, name: "피폐", category: "분위기" },
  { id: 307, name: "새드", category: "분위기", aliases: ["새드엔딩"] },
  { id: 308, name: "쌍방삽질", category: "분위기" },
  { id: 309, name: "배틀레즈", category: "분위기", aliases: ["배틀", "혐관"] },
  { id: 310, name: "후회", category: "분위기" },
  { id: 311, name: "쓰공/수", category: "분위기" },
  { id: 312, name: "리얼물", category: "분위기", aliases: ["리얼물"] },
  { id: 313, name: "노란장판", category: "분위기" },
  { id: 314, name: "애새끼", category: "분위기" },
  { id: 315, name: "봄", category: "분위기", aliases: ["계절"] },
  { id: 316, name: "여름", category: "분위기", aliases: ["계절"] },
  { id: 317, name: "가을", category: "분위기", aliases: ["계절"] },
  { id: 318, name: "겨울", category: "분위기", aliases: ["계절"] },
  { id: 319, name: "오해", category: "분위기" },
  { id: 320, name: "노딱", category: "분위기" },

  // 장르 (400~499)
  { id: 401, name: "로판", category: "장르", aliases: ["로맨틱 판타지"] },
  { id: 402, name: "판타지", category: "장르" },
  { id: 403, name: "SF", category: "장르", aliases: ["미래"] },
  { id: 404, name: "누아르", category: "장르" },

  // 세계관 (500~599)
  { id: 501, name: "좀아포", category: "세계관", aliases: ["좀비", "아포칼립스"] },
  { id: 502, name: "아포칼립스", category: "세계관" },
  { id: 503, name: "오메가버스", category: "세계관", aliases: ["알파오메가", "알오물"] },
  { id: 504, name: "수인", category: "세계관" },
  { id: 505, name: "센티넬버스", category: "세계관", aliases: ["센티넬가이드", "가이드", "센가물"] },
  { id: 506, name: "구원", category: "관계", aliases: ["쌍방구원"] },
  { id: 508, name: "회귀", category: "세계관" },
  { id: 507, name: "기타", category: "세계관", aliases: ["피스틸버스", "하나하키"] },

  // 분량 (600~699)
  { id: 601, name: "단편", category: "분량" },
  { id: 602, name: "중편", category: "분량" },
  { id: 603, name: "장편", category: "분량" },
  { id: 604, name: "썰백업", category: "분량" },

  // 완결 여부 (700~799)
  { id: 701, name: "완결", category: "완결여부" },
  { id: 702, name: "연재중", category: "완결여부" },
];