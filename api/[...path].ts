import {
  brandKitHandler,
  chatHandler,
  healthHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  postsHandler,
  pushSubscribeHandler,
  registerHandler,
  runRemindersHandler,
  stateHandler,
  suggestCopyHandler,
  syncSheetsHandler,
} from "../shared/handlers";
import { HandlerRequest, HandlerResponse } from "../shared/http";

const routes: Record<string, (req: HandlerRequest, res: HandlerResponse) => Promise<void>> = {
  "auth/me": meHandler,
  "auth/register": registerHandler,
  "auth/login": loginHandler,
  "auth/logout": logoutHandler,
  health: healthHandler,
  state: stateHandler,
  "brand-kit": brandKitHandler,
  posts: postsHandler,
  "sync-sheets": syncSheetsHandler,
  "suggest-copy": suggestCopyHandler,
  chat: chatHandler,
  "push-subscribe": pushSubscribeHandler,
  "run-reminders": runRemindersHandler,
};

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  const rawPath = req.query?.path;
  const path = Array.isArray(rawPath) ? rawPath.join("/") : String(rawPath || "");
  const route = routes[path];

  if (!route) {
    res.status(404).json({ error: "API route not found." });
    return;
  }

  await route(req, res);
}
