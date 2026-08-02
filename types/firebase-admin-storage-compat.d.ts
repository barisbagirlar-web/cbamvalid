import type {
  Bucket as GoogleCloudStorageBucket,
  File as GoogleCloudStorageFile,
} from "@google-cloud/storage";

declare module "firebase-admin/lib/storage/storage-namespace" {
  namespace storage {
    type Bucket = GoogleCloudStorageBucket;
    type File = GoogleCloudStorageFile;
  }
}
