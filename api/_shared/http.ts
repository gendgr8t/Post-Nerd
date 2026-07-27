export interface HandlerRequest {
  method?: string;
  body?: any;
  query?: Record<string, any>;
  headers?: Record<string, any>;
}

export interface HandlerResponse {
  status(code: number): HandlerResponse;
  setHeader?(name: string, value: string | string[]): void;
  json(data: unknown): void;
}

export function asyncHandler(fn: (req: HandlerRequest, res: HandlerResponse) => Promise<void>) {
  return async (req: HandlerRequest, res: HandlerResponse) => {
    try {
      await fn(req, res);
    } catch (error: any) {
      console.error(error);
      const message = String(error.message || "");
      if (error.code === "ENOTFOUND" || message.includes("ENOTFOUND")) {
        res.status(500).json({
          error: "The Postgres database host could not be reached. Check DATABASE_URL and make sure the database is online.",
        });
        return;
      }
      if (error.code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
        res.status(500).json({
          error: "The Postgres database refused the connection. Check DATABASE_URL, SSL settings, and database allowlists.",
        });
        return;
      }
      res.status(500).json({ error: message || "Unexpected server error." });
    }
  };
}

export function requireMethod(req: HandlerRequest, res: HandlerResponse, allowed: string[]): boolean {
  const method = req.method || "GET";
  if (!allowed.includes(method)) {
    res.status(405).json({ error: `Method ${method} is not allowed.` });
    return false;
  }
  return true;
}
