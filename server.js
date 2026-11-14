
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running" });
});

// Queue all MCP tool calls so they are at least
// 60 seconds apart, using the same token.
let mcpQueue = Promise.resolve();
let lastMcpCallAt = 0;

function runMcpCall(task) {
  const queuedCall = mcpQueue.then(async () => {
    const waitTime = Math.max(
      0,
      60_000 - (Date.now() - lastMcpCallAt)
    );

    if (waitTime > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, waitTime)
      );
    }

    lastMcpCallAt = Date.now();

    return task();
  });

  mcpQueue = queuedCall.catch(() => undefined);

  return queuedCall;
}

// Inspect available MCP tools.
app.get("/api/tools", async (req, res) => {
  let client;

  try {
    if (!process.env.AQ_TOKEN || !process.env.MCP_URL) {
      return res.status(500).json({
        error: "Missing environment variables"
      });
    }

    client = new Client({
      name: "flytbase-live-crm",
      version: "1.0.0"
    });

    const transport = new StreamableHTTPClientTransport(
      new URL(process.env.MCP_URL),
      {
        requestInit: {
          headers: {
            Authorization: `Bearer ${process.env.AQ_TOKEN}`
          }
        }
      }
    );

    await client.connect(transport);

    const result = await client.listTools();

    res.json(result);
  } catch (error) {
    console.error("Tool inspection error:", error.message);

    res.status(500).json({
      error: error.message
    });
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {}
    }
  }
});

// Generic MCP tool endpoint.
// Supports get_signals, write_note, and other permitted tools.
app.post("/api/tool/:name", async (req, res) => {
  try {
    if (!process.env.AQ_TOKEN || !process.env.MCP_URL) {
      return res.status(500).json({
        connected: false,
        error: "Missing environment variables"
      });
    }

    const result = await runMcpCall(async () => {
      let client;

      try {
        client = new Client({
          name: "flytbase-live-crm",
          version: "1.0.0"
        });

        const transport = new StreamableHTTPClientTransport(
          new URL(process.env.MCP_URL),
          {
            requestInit: {
              headers: {
                Authorization: `Bearer ${process.env.AQ_TOKEN}`
              }
            }
          }
        );

        await client.connect(transport);

        return await client.callTool({
          name: req.params.name,
          arguments: req.body?.arguments ?? {}
        });
      } finally {
        if (client) {
          try {
            await client.close();
          } catch {}
        }
      }
    });

    res.json({
      connected: true,
      tool: req.params.name,
      result
    });
  } catch (error) {
    console.error("MCP error:", error.message);

    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});

// Serve the production frontend.
app.use(express.static(path.join(__dirname, "dist")));

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`CRM running on port ${PORT}`);
});
