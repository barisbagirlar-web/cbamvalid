import { describe, expect, it } from "vitest";
import { assertNapByteParity } from "../../scripts/seo/audit-vertical-modules";
describe("INV-15.4",()=>{it("blocks NAP byte drift",()=>expect(()=>assertNapByteParity(["CBAMValid|A|1","CBAMValid | A | 1"])).toThrow(/INV-15\.4/));it("accepts exact parity",()=>expect(()=>assertNapByteParity(["CBAMValid|A|1","CBAMValid|A|1"])).not.toThrow())});