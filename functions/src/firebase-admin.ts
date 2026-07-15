import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app;

if (!getApps().length) {
  app = initializeApp();
} else {
  app = getApp();
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);

type RawBucket = ReturnType<typeof adminStorage.bucket>;
type RawFile = ReturnType<RawBucket["file"]>;

type SafeFileMetadata = {
  size?: string | number;
  contentType?: string;
  metadata: Record<string, string>;
  [key: string]: unknown;
};

type SafeFile = Omit<RawFile, "exists" | "getMetadata" | "download" | "save"> & {
  exists(): Promise<[boolean]>;
  getMetadata(): Promise<[SafeFileMetadata, unknown]>;
  download(options?: Record<string, unknown>): Promise<[Buffer]>;
  save(data: Buffer | string, options?: Record<string, unknown>): Promise<void>;
};

type SafeBucket = Omit<RawBucket, "file"> & {
  file(name: string, options?: Record<string, unknown>): SafeFile;
};

export function normalizeStorageCustomMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") normalized[key] = entry;
  }
  return normalized;
}

function bindMember(target: object, property: string | symbol): unknown {
  const member = Reflect.get(target, property, target) as unknown;
  return typeof member === "function" ? member.bind(target) : member;
}

function wrapStorageFile(file: RawFile): SafeFile {
  return new Proxy(file, {
    get(target, property) {
      if (property === "getMetadata") {
        return async (): Promise<[SafeFileMetadata, unknown]> => {
          const [metadata, response] = await target.getMetadata();
          return [
            {
              ...metadata,
              metadata: normalizeStorageCustomMetadata(metadata.metadata),
            },
            response,
          ];
        };
      }

      return bindMember(target, property);
    },
  }) as unknown as SafeFile;
}

export const getStorageBucket = (): SafeBucket => {
  const bucket = adminStorage.bucket();
  return new Proxy(bucket, {
    get(target, property) {
      if (property === "file") {
        return (name: string, options?: Record<string, unknown>) =>
          wrapStorageFile(target.file(name, options));
      }

      return bindMember(target, property);
    },
  }) as unknown as SafeBucket;
};

// Use a custom setting for firestore to ignore undefined properties
adminDb.settings({ ignoreUndefinedProperties: true });
