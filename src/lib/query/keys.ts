export type KeyParams = Record<string, string | number | boolean | null | undefined>;
export const createQueryKeys = <F extends string>(feature: F) => ({
  all: [feature] as const,
  lists: () => [feature, "list"] as const,
  list: (params: KeyParams) => [feature, "list", params] as const,
  detail: (id: string) => [feature, "detail", id] as const,
});