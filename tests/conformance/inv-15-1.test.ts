import { describe, expect, it } from "vitest";
import { assertOutOfStockRule } from "../../scripts/seo/audit-vertical-modules";

describe("INV-15.1",()=>{it("blocks temporary OOS retirement",()=>{expect(()=>assertOutOfStockRule({inStock:false,permanentlyRemoved:false,successorUrl:null,responseStatus:404})).toThrow(/INV-15\.1/)});it("allows 200 for temporary OOS",()=>{expect(()=>assertOutOfStockRule({inStock:false,permanentlyRemoved:false,successorUrl:null,responseStatus:200})).not.toThrow()})});