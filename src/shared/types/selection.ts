/** Minimal shape for items rendered by SelectionItem / DataRender (accounts, categories, ...). */
export interface SelectableItem {
  id: string;
  name: string;
  parentId?: string | null;
  color?: string | null;
  iconSlug?: string | null;
  currentBalance?: number | string | null;
}

export type ViewType = "list" | "card";
