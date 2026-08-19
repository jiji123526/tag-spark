export type Tag = {
  id: number;
  name: string;
  category: string;
  aliases?: string[];
};

export type Work = {
  id: number;
  title: string;
  author: string;
  source_url: string;
  aliases?: string[];
  author_aliases?: string[];
  views: number;
  likes: number;
  comments: number;
  posted_at: string | null;
};

export type WorkTag = {
  work_id: number;
  tag_id: number;
  weight: number;
};
