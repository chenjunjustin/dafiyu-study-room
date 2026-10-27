import { chatHandler } from "../lib/vercel-ai.js";

export default async function handler(request, response) {
  await chatHandler(request, response);
}
