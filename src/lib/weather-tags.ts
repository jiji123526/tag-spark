import { WeatherData } from "./weather";

export type WeatherRecommendation = {
  emoji: string;
  message: string;
  tagNames: string[];
  excludeTagNames: string[];
};

// Tags with higher weight are more likely to be picked in the random 3
const HIGH_WEIGHT_TAGS = new Set([
  "봄", "여름", "가을", "겨울",
  "찌통", "새드", "피폐", "누아르",
  "달달", "로코", "캠퍼스", "풋풋",
]);

/**
 * Weighted random pick: high-weight tags get 3x the chance of being selected.
 */
export function pickWeightedTags(tagNames: string[], count: number): string[] {
  const weighted: string[] = [];
  for (const tag of tagNames) {
    const times = HIGH_WEIGHT_TAGS.has(tag) ? 3 : 1;
    for (let i = 0; i < times; i++) weighted.push(tag);
  }
  const shuffled = weighted.sort(() => Math.random() - 0.5);
  const picked: string[] = [];
  for (const tag of shuffled) {
    if (!picked.includes(tag)) picked.push(tag);
    if (picked.length >= count) break;
  }
  return picked;
}

type Season = "봄" | "여름" | "가을" | "겨울";

function getSeason(temp: number, lat?: number): Season {
  if (temp < 5) return "겨울";
  if (temp > 25) return "여름";

  const month = new Date().getMonth() + 1;
  const isNorthern = (lat ?? 37) >= 0;
  const isFirstHalf = month >= 3 && month <= 8;
  if (isNorthern) return isFirstHalf ? "봄" : "가을";
  return isFirstHalf ? "가을" : "봄";
}

export function mapWeatherToTags(weather: WeatherData, lat?: number): WeatherRecommendation {
  const { condition, temp, isNight } = weather;
  const season = getSeason(temp, lat);

  // Rain — melancholy, hardship
  if (condition.includes("rain") || condition.includes("drizzle")) {
    return {
      emoji: "🌧️",
      message: "비 오는 날엔...",
      tagNames: ["찌통", "새드", "이별", "후회", "노란장판", season],
      excludeTagNames: ["연재중", "풋풋", "로코", "힐링"],
    };
  }

  // Thunderstorm — intense, dark
  if (condition.includes("thunderstorm")) {
    return {
      emoji: "⛈️",
      message: "폭풍 같은 날엔...",
      tagNames: ["피폐", "누아르", "조직물", "쓰공/수", "아포칼립스", season],
      excludeTagNames: ["연재중", "달달", "풋풋", "힐링", "애새끼"],
    };
  }

  // Snow — cozy, romantic
  if (condition.includes("snow")) {
    return {
      emoji: "❄️",
      message: "눈 오는 날엔...",
      tagNames: ["달달", "겨울", "풋풋", "로코", "청레"],
      excludeTagNames: ["연재중", "피폐", "누아르", "쓰공/수"],
    };
  }

  // Clear night — romantic, emotional
  if (condition.includes("clear") && isNight) {
    return {
      emoji: "🌙",
      message: "고요한 밤에는...",
      tagNames: ["달달", "엇갈림", "오해", "로코", season],
      excludeTagNames: ["연재중", "노란장판", "아포칼립스"],
    };
  }

  // Hot & clear — energetic, youthful
  if (condition.includes("clear") && temp > 25) {
    return {
      emoji: "☀️",
      message: "더운 날엔...",
      tagNames: ["풋풋", "여름", "캠퍼스", "로코", "여행", "청레"],
      excludeTagNames: ["연재중", "피폐", "새드", "누아르", "쓰공/수"],
    };
  }

  // Freezing & clear — warm feelings
  if (condition.includes("clear") && temp < 5) {
    return {
      emoji: "🥶",
      message: "추운 날엔...",
      tagNames: ["힐링", "달달", "겨울", "육아", "애새끼"],
      excludeTagNames: ["연재중", "피폐", "누아르", "노란장판", "쓰공/수"],
    };
  }

  // Mild & clear — light, fresh
  if (condition.includes("clear")) {
    return {
      emoji: "🌤️",
      message: "맑은 날엔...",
      tagNames: ["힐링", "풋풋", "애새끼", "캠퍼스", "청레", season],
      excludeTagNames: ["연재중", "피폐", "누아르", "찌통", "쓰공/수"],
    };
  }

  // Foggy — mysterious, otherworldly
  if (condition.includes("fog")) {
    return {
      emoji: "🌫️",
      message: "안개 낀 날엔...",
      tagNames: ["판타지", "오해", "회귀", "엇갈림", season],
      excludeTagNames: ["연재중", "로코", "풋풋", "캠퍼스"],
    };
  }

  // Cloudy — mellow, grounded
  if (condition.includes("cloud")) {
    return {
      emoji: "☁️",
      message: "흐린 날엔...",
      tagNames: ["찌통", "엇갈림", "오해", "후회", "이별", season],
      excludeTagNames: ["연재중", "판타지", "아포칼립스"],
    };
  }

  // Fallback
  return {
    emoji: "🌤️",
    message: "오늘 같은 날엔...",
    tagNames: ["힐링", "달달", "로코", season],
    excludeTagNames: ["연재중", "피폐", "쓰공/수"],
  };
}
