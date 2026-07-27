import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

/** App-router /apple-icon — solid brand tile for iOS home screen. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B4332",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 40 40" fill="none">
          <path
            d="M20 3 35 9.5v9.7c0 8.9-6.2 15-15 17.8C11.2 34.2 5 28.1 5 19.2V9.5L20 3Z"
            fill="#D8F3DC"
          />
          <path
            d="m13.5 20.2 4.3 4.3 8.7-9"
            stroke="#1B4332"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
