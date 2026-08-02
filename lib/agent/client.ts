import Anthropic from "@anthropic-ai/sdk";

// Resolves credentials from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login` profile.
export const client = new Anthropic();
