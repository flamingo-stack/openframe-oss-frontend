export const adminQueryKeys = {
  apiKeys: {
    all: ['admin', 'api-keys'] as const,
    list: () => [...adminQueryKeys.apiKeys.all, 'list'] as const,
    detail: (id: string) => [...adminQueryKeys.apiKeys.all, 'detail', id] as const,
  },
};
