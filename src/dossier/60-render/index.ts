/**
 * 60-render is READ-ONLY over DossierModel.
 * INV-1: do not import from 20-kernel, 10-normalize, or case.schema.
 * INV-2: no arithmetic on emission/mass/energy values here.
 *
 * Render implementations live under pdf/ csv/ xlsx/ json/ and must only
 * format Quantity / Coverage strings already present on DossierModel.
 */
export type { DossierModelDto } from "../00-schema/dossier-model.schema";
