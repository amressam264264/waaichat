import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("[SERVER] Starting custom Express server (v3.0.0)...");

  app.use(express.json({ limit: '50mb' }));

  // 1. Proxy - ABSOLUTE TOP, NO MIDDLEWARE
  app.get("/image-proxy-v3", async (req, res) => {
    const targetUrl = req.query.url as string;
    const apiKey = req.query.api_key as string;
    console.log(`[PROXY] Request for: ${targetUrl}`);
    
    if (!targetUrl) {
      return res.status(400).send("URL parameter is required");
    }

    try {
      const headers: any = {};
      // Only use the passed apiKey if it's not empty, otherwise fallback to server's Pollinations key
      const pollinationsKey = (apiKey && apiKey.trim() !== "") ? apiKey : process.env.POLLINATIONS_API_KEY;
      
      let finalUrl = targetUrl;
      if (pollinationsKey) {
        headers["Authorization"] = `Bearer ${pollinationsKey}`;
        console.log(`[PROXY] Using ${apiKey ? 'provided' : 'server'} API key`);
        if (!finalUrl.includes('nologo=')) {
          finalUrl += finalUrl.includes('?') ? '&nologo=true' : '?nologo=true';
        }
      } else {
        console.log(`[PROXY] No API key available`);
      }
      
      const response = await fetch(finalUrl, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[PROXY] Pollinations error (${response.status}):`, errorText);
        return res.status(response.status).send(`Pollinations error: ${errorText}`);
      }

      const contentType = response.headers.get("content-type") || "image/jpeg";
      const buffer = await response.buffer();
      
      console.log(`[PROXY] Fetched ${buffer.length} bytes, type: ${contentType}`);

      res.writeHead(response.status, {
        "Content-Type": contentType,
        "Content-Length": buffer.length,
        "X-Proxy-Source": "Express-Server-V3",
        "Access-Control-Allow-Origin": "*"
      });
      res.end(buffer);
    } catch (error: any) {
      console.error(`[PROXY] Failed: ${targetUrl}`, error.message);
      res.status(500).send(error.message);
    }
  });

  // 2. Hugging Face Image Generation
  app.post("/api/huggingface/image", async (req, res) => {
    try {
      const { prompt, referenceImage, hfToken } = req.body;
      const tokenToUse = hfToken || process.env.HF_TOKEN;

      if (!tokenToUse) {
        return res.status(401).json({ error: "HF_TOKEN environment variable or client token is missing." });
      }

      if (!referenceImage) {
        return res.status(400).json({ error: "A reference image is required for this model." });
      }

      let buffer: Buffer;
      let mimeType = "image/jpeg";

      if (referenceImage.startsWith("http://") || referenceImage.startsWith("https://")) {
        console.log(`[HF] Fetching reference image from URL`);
        const imgRes = await fetch(referenceImage);
        if (!imgRes.ok) {
          return res.status(400).json({ error: "Failed to fetch reference image from URL." });
        }
        const arrayBuffer = await imgRes.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        mimeType = imgRes.headers.get("content-type") || "image/jpeg";
      } else {
        // Extract base64 data
        const match = referenceImage.match(/^data:(image\/\w+);base64,(.+)$/);
        if (!match) {
          return res.status(400).json({ error: "Invalid reference image format. Must be a URL or base64 data URI." });
        }
        const base64Data = match[2];
        buffer = Buffer.from(base64Data, 'base64');
        mimeType = match[1];
      }

      console.log(`[HF] Generating image with HF Router (Replicate provider)`);
      
      // Use HF router with Replicate provider
      const API_URL = "https://router.huggingface.co/replicate/v1/models/black-forest-labs/flux-2-klein-4b/predictions";
      const base64Image = `data:${mimeType};base64,${buffer.toString('base64')}`;
      
      const hfResponse = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${tokenToUse}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: {
            prompt: prompt || "Enhance this image",
            image: base64Image,
            images: [base64Image],
            input_image: base64Image,
            input_images: [base64Image]
          }
        })
      });

      if (!hfResponse.ok) {
        const errText = await hfResponse.text();
        throw new Error(`HF Router Error: ${hfResponse.status} - ${errText}`);
      }

      const data = await hfResponse.json();
      
      if (data.urls && data.urls.get) {
        let isComplete = false;
        let resultUrl = null;
        
        while (!isComplete) {
          await new Promise(r => setTimeout(r, 1000));
          let getUrl = data.urls.get;
          if (getUrl.includes("api.replicate.com")) {
            getUrl = getUrl.replace("api.replicate.com", "router.huggingface.co/replicate");
          }
          
          const pollRes = await fetch(getUrl, {
            headers: {
              "Authorization": `Bearer ${tokenToUse}`
            }
          });
          
          if (!pollRes.ok) {
            throw new Error(`HF Router Poll Error: ${pollRes.status}`);
          }
          
          const pollData = await pollRes.json();
          if (pollData.status === "succeeded") {
            isComplete = true;
            if (Array.isArray(pollData.output) && pollData.output.length > 0) {
              resultUrl = pollData.output[0];
            } else if (typeof pollData.output === 'string') {
              resultUrl = pollData.output;
            }
          } else if (pollData.status === "failed") {
            throw new Error(`Replicate generation failed: ${pollData.error}`);
          }
        }
        
        if (resultUrl) {
          const imgRes = await fetch(resultUrl);
          const arrayBuffer = await imgRes.arrayBuffer();
          const outputBuffer = Buffer.from(arrayBuffer);
          
          res.writeHead(200, {
            "Content-Type": imgRes.headers.get("content-type") || "image/jpeg",
            "Content-Length": outputBuffer.length,
          });
          return res.end(outputBuffer);
        } else {
          throw new Error("No image returned from Replicate API");
        }
      } else {
        throw new Error("Unexpected response from Replicate API");
      }
    } catch (error: any) {
      console.error("[HF] Error generating image:", error);
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  // 3. Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      version: "3.1.0", 
      timestamp: new Date().toISOString(),
      env: {
        hasGeminiKey: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
        hasPollinationsKey: !!process.env.POLLINATIONS_API_KEY,
        details: {
          GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
          API_KEY: !!process.env.API_KEY,
          POLLINATIONS_API_KEY: !!process.env.POLLINATIONS_API_KEY
        }
      }
    });
  });

  // 3. Logger for other requests
  app.use((req, res, next) => {
    console.log(`[SERVER] ${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });

  // 4. Vite/Static Fallback
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
