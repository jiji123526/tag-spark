export type Tag = {
  id: number;
  name: string;
  category: "situation" | "mood" | "relationship";
};

export const tags: Tag[] = [
  { id: 101, name: "Campus", category: "situation" },
  { id: 102, name: "Seaside", category: "situation" },
  { id: 103, name: "Winter", category: "situation" },

  { id: 201, name: "Healing", category: "mood" },
  { id: 202, name: "Melancholy", category: "mood" },
  { id: 203, name: "Cozy", category: "mood" },

  { id: 301, name: "Friends to Lovers", category: "relationship" },
  { id: 302, name: "Rivals", category: "relationship" },
  { id: 303, name: "Second Chance", category: "relationship" },
  { id: 304, name: "Found Family", category: "relationship" },
];
