import { configHandler } from "../lib/vercel-ai.js";

export default function handler(request, response) {
  configHandler(request, response);
}
