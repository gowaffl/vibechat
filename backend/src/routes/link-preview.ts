/**
 * Link Preview API Routes
 * POST /api/link-preview/fetch - Fetch link preview metadata for a URL
 */

import { Hono } from "hono";
import { fetchLinkPreview } from "../services/link-preview";
import { fetchLinkPreviewRequestSchema } from "@/shared/contracts";

const linkPreviewRouter = new Hono();

// POST /api/link-preview/fetch - Fetch link preview metadata
linkPreviewRouter.post("/fetch", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = fetchLinkPreviewRequestSchema.parse(body);

    const previewData = await fetchLinkPreview(validatedData.url);

    if (!previewData) {
      return c.json({ error: "Failed to fetch link preview" }, 500);
    }

    return c.json(previewData);
  } catch (error) {
    console.error("[API] Link preview fetch error:", error);
    return c.json({ error: "Failed to fetch link preview" }, 500);
  }
});

export { linkPreviewRouter };
