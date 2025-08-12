export type WorkTag = {
  work_id: number;
  tag_id: number;
  weight: 2.0 | 1.0;
};

// 2.0 = core tag, 1.0 = secondary tag
export const workTags: WorkTag[] = [
  // Campus Serenity
  { work_id: 1, tag_id: 101, weight: 2.0 },
  { work_id: 1, tag_id: 201, weight: 2.0 },
  { work_id: 1, tag_id: 203, weight: 1.0 },
  { work_id: 1, tag_id: 301, weight: 1.0 },

  // Quiet Healing
  { work_id: 2, tag_id: 201, weight: 2.0 },
  { work_id: 2, tag_id: 202, weight: 1.0 },
  { work_id: 2, tag_id: 303, weight: 2.0 },

  // Rivals to Lovers
  { work_id: 3, tag_id: 302, weight: 2.0 },
  { work_id: 3, tag_id: 201, weight: 1.0 },
  { work_id: 3, tag_id: 101, weight: 1.0 },

  // Seaside Letters
  { work_id: 4, tag_id: 102, weight: 2.0 },
  { work_id: 4, tag_id: 203, weight: 2.0 },
  { work_id: 4, tag_id: 301, weight: 1.0 },

  // Winter Campus Nights
  { work_id: 5, tag_id: 103, weight: 2.0 },
  { work_id: 5, tag_id: 101, weight: 2.0 },
  { work_id: 5, tag_id: 202, weight: 1.0 },

  // Second Chances
  { work_id: 6, tag_id: 303, weight: 2.0 },
  { work_id: 6, tag_id: 201, weight: 1.0 },
  { work_id: 6, tag_id: 304, weight: 1.0 },
];
