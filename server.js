
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

app.get("/api/tools", async (req, res) => {
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

    const result = await client.listTools();
    res.json(result);
  } catch (error) {
    console.error("Tool inspection error:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    if (client) {
      try { await client.close(); } catch {}
    }
  }
});

app.post("/api/tool/:name", async (req, res) => {
  let client;

  try {
    if (!process.env.AQ_TOKEN || !process.env.MCP_URL) {
      return res.status(500).json({ error: "Missing environment variables" });
    }

    client = new Client({ name: "flytbase-live-crm", version: "1.0.0" });

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

    const result = await client.callTool({
      name: req.params.name,
      arguments: req.body?.arguments ?? {}
    });

    res.json({ connected: true, tool: req.params.name, result });
  } catch (error) {
    console.error("MCP error:", error.message);
    res.status(500).json({ connected: false, error: error.message });
  } finally {
    if (client) {
      try { await client.close(); } catch {}
    }
  }
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => console.log(`CRM running on port ${PORT}`));
