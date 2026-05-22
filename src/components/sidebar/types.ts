export interface SpaceItem {
  id: string;
  name: string;
  slug: string;
  type: "personal" | "team" | "organization";
  icon?: string;
  classification?: "public" | "internal" | "confidential" | "secret";
  ownerAvatarUrl?: string | null;
  ownerEmail?: string | null;
}

export interface DocumentItem {
  id: string;
  title: string;
  slug: string;
  isFolder: boolean;
  icon?: string | null;
  children?: DocumentItem[];
  labels?: { id: string; name: string; color: string }[];
}
