export function readWorkspaceHint(search: string): string | undefined {
  return new URLSearchParams(search).get('workspace') || undefined;
}

export function withWorkspaceHint(destination: string, workspace?: string): string {
  return workspace ? `${destination}?${new URLSearchParams({ workspace })}` : destination;
}
