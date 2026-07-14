"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGAL_VERSIONS = void 0;
exports.getLegalVersion = getLegalVersion;
exports.LEGAL_VERSIONS = [
    {
        versionId: "EU_2023_956",
        name: "Regulation (EU) 2023/956 of the European Parliament and of the Council establishing a carbon border adjustment mechanism",
        enactedAt: "2023-05-10T00:00:00Z",
        active: true,
    },
];
function getLegalVersion(versionId) {
    return exports.LEGAL_VERSIONS.find((v) => v.versionId === versionId) || null;
}
//# sourceMappingURL=legal-version-service.js.map