import { personaHandler } from "../lib/vercel-ai.js";

export default function handler(request, response) {
  personaHandler(request, response);
}
