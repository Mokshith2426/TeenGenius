import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const key = process.env.GEMINI_API_KEY?.trim();
if (!key) {
  console.log("[AI DEBUG] configured=false");
  console.log("[AI DEBUG] error name=AI_NOT_CONFIGURED");
  console.log("[AI DEBUG] error code=none");
  console.log("[AI DEBUG] upstream status=none");
  console.log("[AI DEBUG] sanitized message=No API key configured");
  process.exit(1);
}

console.log("[AI DEBUG] configured=true");
console.log("[AI DEBUG] model=gemini-2.5-flash");

const ai = new GoogleGenAI({ apiKey: key });

try {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Reply with exactly: TEENGENIUS_AI_OK"
  });
  
  const text = response.text?.trim() || "";
  console.log("[AI DEBUG] error name=null");
  console.log("[AI DEBUG] error code=null");
  console.log("[AI DEBUG] upstream status=null");
  console.log("[AI DEBUG] sanitized message=Success");
  console.log("\n=== GEMINI RESPONSE ===");
  console.log(text);
  console.log("=======================\n");
  
  if (text === "TEENGENIUS_AI_OK") {
    console.log("\n✓ CONTROLLED GEMINI TEST: PASS");
    process.exit(0);
  } else {
    console.log("\n✗ CONTROLLED GEMINI TEST: FAIL - Wrong response");
    process.exit(1);
  }
} catch (error) {
  console.log("[AI DEBUG] error name=" + (error?.name || "Unknown"));
  console.log("[AI DEBUG] error code=" + (error?.code || "none"));
  console.log("[AI DEBUG] upstream status=" + (error?.status || "none"));
  console.log("[AI DEBUG] sanitized message=" + (error?.message || String(error)));
  console.log("\n✗ CONTROLLED GEMINI TEST: FAIL");
  process.exit(1);
}