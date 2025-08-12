import cover1 from "@/assets/cover-abstract-1.jpg";
import cover2 from "@/assets/cover-abstract-2.jpg";
import cover3 from "@/assets/cover-abstract-3.jpg";

export type Work = {
  id: number;
  title: string;
  author: string;
  cover_url: string;
  source_url: string;
};

export const works: Work[] = [
  {
    id: 1,
    title: "Campus Serenity",
    author: "A. Lin",
    cover_url: cover1,
    source_url: "https://example.com/work/campus-serenity",
  },
  {
    id: 2,
    title: "Quiet Healing",
    author: "M. Reyes",
    cover_url: cover2,
    source_url: "https://example.com/work/quiet-healing",
  },
  {
    id: 3,
    title: "Rivals to Lovers",
    author: "J. Park",
    cover_url: cover3,
    source_url: "https://example.com/work/rivals-to-lovers",
  },
  {
    id: 4,
    title: "Seaside Letters",
    author: "K. Ito",
    cover_url: cover2,
    source_url: "https://example.com/work/seaside-letters",
  },
  {
    id: 5,
    title: "Winter Campus Nights",
    author: "S. Arora",
    cover_url: cover1,
    source_url: "https://example.com/work/winter-campus-nights",
  },
  {
    id: 6,
    title: "Second Chances",
    author: "L. Gomez",
    cover_url: cover3,
    source_url: "https://example.com/work/second-chances",
  },
];
