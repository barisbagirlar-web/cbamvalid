import { z } from "zod";

const TOKEN_VERSION = 1;

type UserPageCursor = {
  version: typeof TOKEN_VERSION;
  documentId: string;
};

export const AdminListUsersInputSchema = z.object({
  limit: z.number().int().min(1).max(500).nullish().transform(v => v ?? 100),
  pageToken: z.string().trim().min(1).max(512).optional(),
}).optional();

export const AdminListTransactionsInputSchema = z.object({
  limit: z.number().int().min(1).max(500).nullish().transform(v => v ?? 100),
}).optional();

export const AdminSetUserTokensInputSchema = z.object({
  targetUserId: z.string().trim().min(1).max(128).regex(/^[^/\u0000-\u001f]+$/),
  tokensToSet: z.number().int().min(0).max(1_000_000),
});

export function encodeUserPageToken(documentId: string): string {
  const normalized = documentId.trim();
  if (!normalized || normalized.length > 128 || /[\u0000-\u001f/]/.test(normalized)) {
    throw new Error("ADMIN_USER_PAGE_CURSOR_INVALID");
  }
  const cursor: UserPageCursor = {
    version: TOKEN_VERSION,
    documentId: normalized,
  };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeUserPageToken(token: string): UserPageCursor {
  try {
    if (!token || token.length > 512 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      throw new Error("invalid token encoding");
    }
    const raw = JSON.parse(Buffer.from(token, "base64url").toString("utf8")) as Partial<UserPageCursor>;
    if (
      raw.version !== TOKEN_VERSION ||
      typeof raw.documentId !== "string" ||
      !raw.documentId.trim() ||
      raw.documentId.length > 128 ||
      /[\u0000-\u001f/]/.test(raw.documentId)
    ) {
      throw new Error("invalid cursor payload");
    }
    return { version: TOKEN_VERSION, documentId: raw.documentId };
  } catch {
    throw new Error("ADMIN_USER_PAGE_TOKEN_INVALID");
  }
}
