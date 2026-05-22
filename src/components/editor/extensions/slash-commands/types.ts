import type { Editor, Range } from "@tiptap/core";

export interface CommandItem {
  title: string;
  description: string;
  aliases?: string[];
  icon: React.ReactNode;
  command: (props: { editor: Editor; range: Range }) => void;
  desktopOnly?: boolean;
}

export interface CommandListProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
}

export interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}
