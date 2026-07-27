import { renderAiTxt } from "@/lib/seo/ai-txt";

export function GET() {
  return new Response(renderAiTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
