import { Card, CardContent } from "@/components/ui/card";
import { Work } from "@/data/works";

type Props = {
  work: Work;
};

const WorkCard = ({ work }: Props) => {
  return (
    <a href={work.source_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${work.title} by ${work.author}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        <img
          src={work.cover_url}
          alt={`${work.title} cover art`}
          loading="lazy"
          className="h-48 w-full object-cover"
        />
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">{work.author}</p>
          <h3 className="mt-1 font-medium leading-tight">{work.title}</h3>
        </CardContent>
      </Card>
    </a>
  );
};

export default WorkCard;
