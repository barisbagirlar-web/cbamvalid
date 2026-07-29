import crypto from "node:crypto";

type IndexedArtifact = {
  sha256: string;
  sizeBytes: number;
};

export function verifyPublicPackageSignature(params: {
  reportId: string;
  reportManifestHash: string;
  manifestBytes: Buffer;
  manifestIndex: IndexedArtifact;
  signatureBytes: Buffer;
  signatureIndex: IndexedArtifact;
}): boolean {
  try {
    const manifestHash = crypto.createHash("sha256").update(params.manifestBytes).digest("hex");
    const signatureHash = crypto.createHash("sha256").update(params.signatureBytes).digest("hex");
    if (
      params.manifestBytes.byteLength !== params.manifestIndex.sizeBytes ||
      manifestHash !== params.manifestIndex.sha256.toLowerCase() ||
      manifestHash !== params.reportManifestHash.toLowerCase() ||
      params.signatureBytes.byteLength !== params.signatureIndex.sizeBytes ||
      signatureHash !== params.signatureIndex.sha256.toLowerCase()
    ) return false;

    const manifest = JSON.parse(params.manifestBytes.toString("utf8")) as { reportId?: string };
    const signature = JSON.parse(params.signatureBytes.toString("utf8")) as {
      manifestHash?: string;
      signatureBase64?: string;
      publicKeyPem?: string;
    };
    return Boolean(
      manifest.reportId === params.reportId &&
      signature.manifestHash === manifestHash &&
      signature.signatureBase64 &&
      signature.publicKeyPem &&
      crypto.verify(
        "sha256",
        params.manifestBytes,
        signature.publicKeyPem,
        Buffer.from(signature.signatureBase64, "base64")
      )
    );
  } catch {
    return false;
  }
}
