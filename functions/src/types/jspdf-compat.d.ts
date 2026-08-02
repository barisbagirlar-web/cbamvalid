import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    /**
     * jsPDF accepts RGB/CMYK arrays at runtime. Its published overloads are
     * narrower than the implementation and reject a validated colour tuple
     * spread under strict TypeScript. This augmentation reflects the runtime
     * contract without changing report behaviour.
     */
    setFillColor(...channels: Array<number | string>): this;
  }
}
