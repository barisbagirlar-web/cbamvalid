import "jspdf";

declare module "jspdf" {
  interface jsPDF {
    setFillColor(...channels: Array<number | string>): this;
  }
}
