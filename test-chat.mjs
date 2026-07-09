import "dotenv/config";

async function testChat() {
  const payload = {
    message: "Reply with exactly: TEENGENIUS_AI_OK",
    history: []
  };

  console.log("[TEST] Sending POST to /api/gemini/chat");
  console.log("[TEST] Payload:", JSON.stringify(payload));

  try {
    const response = await fetch("http://localhost:3000/api/gemini/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("[TEST] HTTP status:", response.status);
    
    const data = await response.json();
    console.log("[TEST] Response JSON:", JSON.stringify(data, null, 2));
    
    if (data.text === "TEENGENIUS_AI_OK") {
      console.log("\n✓ CHAT TEST: PASS");
      process.exit(0);
    } else {
      console.log("\n✗ CHAT TEST: FAIL - Wrong response text");
      process.exit(1);
    }
  } catch (error) {
    console.log("[TEST] error name=" + (error?.name || "Unknown"));
    console.log("[TEST] error message=" + (error?.message || String(error)));
    console.log("\n✗ CHAT TEST: FAIL");
    process.exit(1);
  }
}

testChat();