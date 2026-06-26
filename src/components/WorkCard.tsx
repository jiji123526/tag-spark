import { Tag, Work } from "@/lib/types";

type Props = {
  work: Work;
  tagList?: Tag[]; // 작품에 포함된 태그들 (전부 표시)
};

export default function WorkCard({ work, tagList }: Props) {
  return (
    // 카드 전체를 링크로
    <a
      href={work.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full max-w-sm rounded-lg border bg-card text-card-foreground shadow-sm transition hover:shadow-md"
    >
      <div className="p-4">
        {/* 제목/작가 */}
        <h3 className="text-base font-semibold">{work.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{work.author}</p>

        {/* 태그 모두 표시 */}
        {tagList && tagList.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {tagList.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs bg-background/70"
                title={
                  t.aliases && t.aliases.length > 0
                    ? `별칭: ${t.aliases.join(", ")}`
                    : undefined
                }
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </a>
  );
}