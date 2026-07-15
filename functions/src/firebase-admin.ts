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
type RawMetadataResult = Awaited<ReturnType<RawFile["getMetadata"]>>;
type RawMetadata = RawMetadataResult[0];
type SafeMetadata = Omit<RawMetadata, "metadata"> & { metadata: Record<string, string> };
type SafeMetadataResult = RawMetadataResult extends [unknown, ...infer Rest]
  ? [SafeMetadata, ...Rest]
  : [SafeMetadata];
type SafeFile = Omit<RawFile, "getMetadata"> & {
  getMetadata(...args: Parameters<RawFile["getMetadata"]>): Promise<SafeMetadataResult>;
};
type SafeBucket = Omit<RawBucket, "file"> & {
  file(...args: Parameters<RawBucket["file"]>): SafeFile;
};

export function normalizeStorageCustomMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const normalized: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") normalized[key] = entry;
  }
  return normalized;
}

function wrapStorageFile(file: RawFile): SafeFile {
  return new Proxy(file, {
    get(target, property) {
      if (property === "getMetadata") {
        return async (...args: Parameters<RawFile["getMetadata"]>): Promise<SafeMetadataResult> => {
          const result = await target.getMetadata(...args);
          const [metadata, ...rest] = result;
          const safeMetadata: SafeMetadata = {
            ...metadata,
            metadata: normalizeStorageCustomMetadata(metadata.metadata),
          };
          return [safeMetadata, ...rest] as SafeMetadataResult;
        };
      }

      const member = Reflect.get(target, property, target) as unknown;
      return typeof member === "function" ? member.bind(target) : member;
    },
  }) as SafeFile;
}

export const getStorageBucket = (): SafeBucket => {
  const bucket = adminStorage.bucket();
  return new Proxy(bucket, {
    get(target, property) {
      if (property === "file") {
        return (...args: Parameters<RawBucket["file"]>) => wrapStorageFile(target.file(...args));
      }

      const member = Reflect.get(target, property, target) as unknown;
      return typeof member === "function" ? member.bind(target) : member;
    },
  }) as SafeBucket;
};

// Use a custom setting for firestore to ignore undefined properties
adminDb.settings({ ignoreUndefinedProperties: true });
