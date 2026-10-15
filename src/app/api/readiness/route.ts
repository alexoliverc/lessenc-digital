import { createReadinessHandler } from "./readiness-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createReadinessHandler();
