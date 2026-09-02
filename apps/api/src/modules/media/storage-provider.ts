import { Readable } from "node:stream";

export interface StoredObject {
  body: Readable;
  contentType: string;
  contentLength: number;
  etag: string | null;
}

export interface StorageProvider {
  readonly available: boolean;
  checkReadiness(): Promise<void>;
  putObject(input: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<{ etag: string | null }>;
  getObject(key: string): Promise<StoredObject | null>;
  deleteObject(key: string): Promise<void>;
}

export class StorageUnavailableError extends Error {
  constructor() {
    super("Object storage is unavailable");
    this.name = "StorageUnavailableError";
  }
}

export class StorageFeatureUnavailableError extends StorageUnavailableError {
  constructor() {
    super();
    this.name = "StorageFeatureUnavailableError";
  }
}

export class UnavailableStorageProvider implements StorageProvider {
  readonly available = false;

  checkReadiness(): Promise<never> {
    return Promise.reject(new StorageFeatureUnavailableError());
  }

  putObject(): Promise<never> {
    return Promise.reject(new StorageFeatureUnavailableError());
  }

  getObject(): Promise<never> {
    return Promise.reject(new StorageFeatureUnavailableError());
  }

  deleteObject(): Promise<never> {
    return Promise.reject(new StorageFeatureUnavailableError());
  }
}

export class InMemoryStorageProvider implements StorageProvider {
  readonly available = true;
  readonly objects = new Map<
    string,
    { body: Buffer; contentType: string; etag: string }
  >();
  failNextPut = false;
  failNextDelete = false;

  checkReadiness() {
    return Promise.resolve();
  }

  putObject(input: { key: string; body: Buffer; contentType: string }) {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new StorageUnavailableError();
    }
    const etag = `memory-${input.body.byteLength}`;
    this.objects.set(input.key, {
      body: Buffer.from(input.body),
      contentType: input.contentType,
      etag,
    });
    return Promise.resolve({ etag });
  }

  getObject(key: string): Promise<StoredObject | null> {
    const object = this.objects.get(key);
    return Promise.resolve(
      object
        ? {
            body: Readable.from(object.body),
            contentType: object.contentType,
            contentLength: object.body.byteLength,
            etag: object.etag,
          }
        : null,
    );
  }

  deleteObject(key: string) {
    if (this.failNextDelete) {
      this.failNextDelete = false;
      throw new StorageUnavailableError();
    }
    this.objects.delete(key);
    return Promise.resolve();
  }
}
