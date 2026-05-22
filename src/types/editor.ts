/**
 * Types for TipTap editor extensions — LorIAx
 *
 * Centralises typing for:
 * - Global window properties injected by loriax-editor.tsx
 * - Suggestion popup component refs (Mention, WikiLink, SlashCommands)
 */

// ─── Global window properties ───────────────────────────────────────────────

/**
 * Properties injected on `window` by loriax-editor.tsx
 * to share spaceId/docId with editor extension blocks.
 */
export interface LorIAxWindowProps {
  __loriax_spaceId?: string;
  __loriax_docId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Window extends LorIAxWindowProps {}
}

// ─── Suggestion popup ref ───────────────────────────────────────────────────

/**
 * Ref exposed by suggestion list components (MentionList, WikiLinkList, CommandList)
 * via useImperativeHandle. Used in onKeyDown handlers.
 */
export interface SuggestionListRef {
  onKeyDown(props: { event: KeyboardEvent }): boolean;
}
