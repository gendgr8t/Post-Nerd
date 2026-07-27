import { loginHandler, logoutHandler, meHandler, registerHandler } from "../../shared/handlers.ts";
import { HandlerRequest, HandlerResponse } from "../../shared/http.ts";

const routes: Record<string, (req: HandlerRequest, res: HandlerResponse) => Promise<void>> = {
  me: meHandler,
  register: registerHandler,
  login: loginHandler,
  logout: logoutHandler,
};

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  const action = String(req.query?.action || "");
  const route = routes[action];

  if (!route) {
    res.status(404).json({ error: "Auth route not found." });
    return;
  }

  await route(req, res);
}
