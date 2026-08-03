export const CONTROLLED_WORKSPACE_UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
export const CONTROLLED_WORKSPACE_EMAIL = "teb232@gmail.com";

type WorkspaceIdentity = {
  uid: string;
  email?: string | null;
};

export function isControlledWorkspaceAccount(identity: WorkspaceIdentity): boolean {
  return (
    identity.uid === CONTROLLED_WORKSPACE_UID &&
    identity.email?.trim().toLowerCase() === CONTROLLED_WORKSPACE_EMAIL
  );
}

export function projectClientWorkspaceClaims<T extends Record<string, unknown>>(
  identity: WorkspaceIdentity,
  claims: T
): T {
  if (!isControlledWorkspaceAccount(identity)) return claims;

  return {
    ...claims,
    admin: false,
    ownerAdmin: false,
  } as T;
}
