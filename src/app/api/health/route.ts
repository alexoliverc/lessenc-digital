import { NextResponse } from "next/server";

import { getHealthStatus } from "@/modules/health/health";

export function GET() {
  return NextResponse.json(getHealthStatus(), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
