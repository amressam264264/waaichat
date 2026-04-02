import fetch from "node-fetch";
import fs from "fs";

async function test() {
  try {
    const buffer = fs.readFileSync("package.json"); // dummy file
    const base64Image = `data:text/plain;base64,${buffer.toString('base64')}`;
    
    const API_URL = "https://router.huggingface.co/replicate/v1/models/black-forest-labs/flux-2-klein-4b/predictions";
    const hfResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          prompt: "test",
          image: base64Image
        }
      })
    });

    console.log("Status:", hfResponse.status);
    const data = await hfResponse.json();
    console.log("Response:", data);
    
    if (data.urls && data.urls.get) {
      let isComplete = false;
      while (!isComplete) {
        await new Promise(r => setTimeout(r, 1000));
        // Note: Replicate's get URL is api.replicate.com, but we need to use router.huggingface.co/replicate
        // Let's see if the get URL returned is already router.huggingface.co or api.replicate.com
        let getUrl = data.urls.get;
        if (getUrl.includes("api.replicate.com")) {
          getUrl = getUrl.replace("api.replicate.com", "router.huggingface.co/replicate");
        }
        console.log("Polling:", getUrl);
        const pollRes = await fetch(getUrl, {
          headers: {
            "Authorization": `Bearer ${process.env.HF_TOKEN}`
          }
        });
        const pollData = await pollRes.json();
        console.log("Poll status:", pollData.status);
        if (pollData.status === "succeeded" || pollData.status === "failed") {
          isComplete = true;
          console.log("Final output:", pollData.output);
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}
test();
