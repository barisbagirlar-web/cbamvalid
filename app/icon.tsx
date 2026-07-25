import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAFAF8",
          color: "#1B4332",
          border: "2px solid #1A1A1A",
          borderRadius: "8px",
          fontFamily: "Georgia",
          fontSize: "22px",
          fontWeight: 700,
        }}
      >
        C
      </div>
    ),
    size
  );
}
