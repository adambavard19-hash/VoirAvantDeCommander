export type UploadTarget = {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
};

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  getBuffer(key: string): Promise<Buffer | null>;
  stat(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  /** URL publique de lecture (CDN ou route /files). */
  publicUrl(key: string): string;
  /** Cible de téléversement direct depuis le navigateur (évite de faire transiter les gros fichiers 3D par l'API). */
  createUploadTarget(key: string, contentType: string, maxBytes: number): Promise<UploadTarget>;
}
