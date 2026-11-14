
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import process from "node:process";
dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Backend health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Backend is running" });
});

// Reusable MCP tool endpoint
app.post("/api/tool/:name", async (req, res) => {
  let client;

  try {
    if (!process.env.AQ_TOKEN || !process.env.MCP_URL) {
      return res.status(500).json({
        error: "AQ_TOKEN or MCP_URL is missing from the .env file."
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

    // Call the MCP tool requested by the API URL.
    const result = await client.callTool({
      name: req.params.name,
      arguments: req.body?.arguments ?? {}
    });

    res.json({
      connected: true,
      tool: req.params.name,
      result
    });

  } catch (error) {
    console.error("MCP connection failed:", error.message);

    res.status(500).json({
      connected: false,
      error: error.message
    });

  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Ignore connection cleanup errors.
      }
    }
  }
});

// Start backend server
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
