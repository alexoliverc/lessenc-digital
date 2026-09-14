export function normalizeRelativeBackupPath(input: string): string;

export function assertAllowedStoragePath(input: string): string;

export function sha256File(path: string): Promise<string>;

export function parseDatabaseUrl(rawUrl: string): {
  protocol: string;
  hostname: string;
  port: string;
  username: string;
  password: string;
  databaseName: string;
};

export function createManifest(input: {
  backupId: string;
  createdAt: string;
  databaseName: string;
  databaseDump: {
    bytes: number;
    sha256: string;
  };
  migrations: Array<{
    name: string;
    sha256: string;
  }>;
  storageFiles: Array<{
    relativePath: string;
    bytes: number;
    sha256: string;
  }>;
}): {
  formatVersion: number;
  backupId: string;
  createdAt: string;
  databaseName: string;
  databaseDump: {
    file: string;
    bytes: number;
    sha256: string;
  };
  migrations: Array<{
    name: string;
    sha256: string;
  }>;
  storage: {
    fileCount: number;
    totalBytes: number;
    files: Array<{
      relativePath: string;
      bytes: number;
      sha256: string;
    }>;
  };
};

export function assertSafeManifest(manifest: unknown): void;

export function verifyBundle(bundleDirectory: string): Promise<{
  formatVersion: number;
  backupId: string;
  createdAt: string;
  databaseName: string;
  databaseDump: {
    file: string;
    bytes: number;
    sha256: string;
  };
  migrations: Array<{
    name: string;
    sha256: string;
  }>;
  storage: {
    fileCount: number;
    totalBytes: number;
    files: Array<{
      relativePath: string;
      bytes: number;
      sha256: string;
    }>;
  };
}>;
