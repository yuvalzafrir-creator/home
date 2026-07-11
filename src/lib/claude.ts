import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function askClaude(prompt: string): Promise<string> {
  const anthropic = getClaudeClient();
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block.type === "text" ? block.text : "";
}
