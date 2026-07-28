import { createHash } from "node:crypto";
import {
  AuditReadyCaseSchema,
  type AuditReadyCase,
  type InputDatum,
} from "../schema";

type UnknownRecord = Record<string, unknown>;

const LEGACY_FIELD_NAMES = [
  "exporterName",
  "declarantEORI",
  "importYear",
  "importQuarter",
  "role",
  "cnCode",
  "productionVolume",
  "shipmentRecordsCount",
  "installationName",
  "productionRoute",
  "hasActualData",
  "directEmissions",
  "electricityConsumed",
  "gridEmissionFactor",
  "isComplexGood",
  "precursorDirectEmissions",
  "precursorIndirectEmissions",
  "carbonPricePaid",
  "isVerified",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function legacyValue(value: unknown): string | number | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function datum(value: unknown, canonicalUnit?: string): InputDatum {
  return {
    value: legacyValue(value),
    ...(canonicalUnit ? { canonicalUnit } : {}),
    sourceType: "ESTIMATED",
    confidenceStatus: "LOW_ESTIMATE",
    reviewerNote: "Recovered from a legacy CBAMValid draft; source evidence must be re-linked.",
  };
}

function validIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function deterministicEventId(caseId: string): string {
  const digest = createHash("sha256").update(`legacy-case-adapter:${caseId}`).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function sectorFromCnCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const chapter = value.trim().slice(0, 2);
  if (chapter === "72" || chapter === "73") return "IRON_AND_STEEL";
  if (chapter === "76") return "ALUMINIUM";
  if (chapter === "25") return "CEMENT";
  if (chapter === "31") return "FERTILISERS";
  if (chapter === "28") return "HYDROGEN";
  if (chapter === "27") return "ELECTRICITY";
  return null;
}

function preservedLegacyValues(source: UnknownRecord): UnknownRecord {
  return Object.fromEntries(
    LEGACY_FIELD_NAMES
      .filter((key) => hasOwn(source, key))
      .map((key) => [key, source[key]])
      .filter((entry) => {
        const value = entry[1];
        return value === null || ["string", "number", "boolean"].includes(typeof value);
      })
  );
}

export function isRecognizedLegacyCaseData(value: unknown): value is UnknownRecord {
  if (!isRecord(value)) return false;
  const hasLegacyIdentity = [
    "exporterName",
    "declarantEORI",
    "cnCode",
    "installationName",
  ].some((key) => hasOwn(value, key));
  const hasPrimitiveEmission = [
    "directEmissions",
    "electricityConsumed",
    "gridEmissionFactor",
  ].some((key) => hasOwn(value, key) && !isRecord(value[key]));
  return hasLegacyIdentity || hasPrimitiveEmission;
}

export function adaptLegacyCaseData(params: {
  rawData: unknown;
  caseId: string;
  uid: string;
  createdAt: string;
  updatedAt: string;
}): AuditReadyCase | null {
  if (!isRecognizedLegacyCaseData(params.rawData)) return null;
  const source = params.rawData;
  const sector = sectorFromCnCode(source.cnCode);
  const hasGoodData = [
    source.cnCode,
    source.productionVolume,
    source.shipmentRecordsCount,
  ].some((value) => legacyValue(value) !== null);
  const goods = hasGoodData && sector
    ? [{
        cnCode: datum(source.cnCode),
        sector,
        productionVolume: datum(source.productionVolume, "t"),
        shipmentRecords: datum(source.shipmentRecordsCount),
        allocationShare: datum(1, "fraction"),
      }]
    : [];
  const hasPrecursorData = source.isComplexGood === true || [
    source.precursorDirectEmissions,
    source.precursorIndirectEmissions,
  ].some((value) => legacyValue(value) !== null);
  const fallbackTimestamp = "1970-01-01T00:00:00.000Z";
  const adaptedAt = validIsoTimestamp(
    params.updatedAt,
    validIsoTimestamp(params.createdAt, fallbackTimestamp)
  );

  return AuditReadyCaseSchema.parse({
    caseId: params.caseId,
    status: "DRAFT",
    version: 1,
    ownerId: params.uid,
    importerIdentity: {
      legalName: datum(null),
      eoriNumber: datum(source.declarantEORI),
    },
    exporterIdentity: {
      legalName: datum(source.exporterName),
    },
    reportingPeriod: {
      year: datum(source.importYear),
      quarter: datum(
        typeof source.importQuarter === "number"
          ? `Q${source.importQuarter}`
          : source.importQuarter
      ),
    },
    goods,
    installation: {
      name: datum(source.installationName),
      country: datum(null),
      productionRoute: datum(source.productionRoute),
      systemBoundaries: "Legacy draft: system boundary was not recorded in the earlier data model.",
    },
    directEmissions: datum(source.directEmissions, "tCO2e"),
    electricityConsumed: datum(source.electricityConsumed, "MWh"),
    gridEmissionFactor: datum(source.gridEmissionFactor, "tCO2e/MWh"),
    precursors: hasPrecursorData
      ? [{
          name: datum("Legacy aggregate precursor record"),
          quantity: datum(null, "t"),
          directEmissions: datum(source.precursorDirectEmissions, "tCO2e"),
          indirectEmissions: datum(source.precursorIndirectEmissions, "tCO2e"),
          countryOfOrigin: datum(null),
        }]
      : [],
    carbonPriceRecords: [],
    evidenceRegister: [],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [],
    auditEvents: [{
      eventId: deterministicEventId(params.caseId),
      timestamp: adaptedAt,
      actor: params.uid,
      action: "LEGACY_CASE_ADAPTED",
      metadata: {
        sourceSchema: "LEGACY_FLAT_V1",
        migrationMode: "READ_COMPATIBILITY_VIEW",
        preservedLegacyValues: preservedLegacyValues(source),
      },
    }],
  });
}
