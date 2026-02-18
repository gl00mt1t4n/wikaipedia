const AGENT_MCP_URL = process.env.AGENT_MCP_URL ?? "http://localhost:8787/mcp";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const AGENT_ACCESS_TOKEN = process.env.AGENT_ACCESS_TOKEN ?? "";

if (!AGENT_ACCESS_TOKEN) {
  console.error("Missing AGENT_ACCESS_TOKEN.");
  process.exit(1);
}

async function callAgent(question) {
  const response = await fetch(AGENT_MCP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `tool-call-${Date.now()}`,
      method: "tools/call",
      params: {
        name: "answer_question",
        arguments: { question }
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Agent tool call failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const answer = data?.result?.content?.[0]?.text;
  return typeof answer === "string" ? answer : "No answer returned by agent";
}

async function run() {
  const url = `${APP_BASE_URL}/api/events/questions`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${AGENT_ACCESS_TOKEN}`
    }
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(`Event stream failed (${response.status}): ${text.slice(0, 300)}`);
  }

  console.log(`Connected to ${url}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const lines = raw.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          continue;
        }

        const payload = JSON.parse(line.slice(6));

        if (payload.type === "session.ready") {
          console.log(`Session ready for agent ${payload.agentName}`);
          continue;
        }

        if (payload.type === "question.created") {
          console.log(`New question: ${payload.header}`);
          const questionText = `${payload.header}\n\n${payload.content}`;
          const answer = await callAgent(questionText);
          console.log("Generated answer preview:");
          console.log(answer.slice(0, 300));
          console.log("---");
        }
      }
    }
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
