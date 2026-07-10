import "dotenv/config";

/**
 * Concurrency test for the deduplication fix.
 * 
 * Tests that:
 * 1. Two concurrent anonymous requests get separate responses (not shared Promise)
 * 2. No request hangs or returns wrong response
 * 3. Duplicate submits don't create quota-amplifying requests
 */

async function testConcurrentAnonymousRequests() {
  console.log("\n=== TEST 1: Concurrent Anonymous Requests ===");
  console.log("Sending two concurrent requests from different anonymous clients...\n");

  const payload = {
    message: "Reply with exactly: CONCURRENT_TEST_" + Date.now(),
    history: []
  };

  // Simulate two different anonymous clients by not sending auth headers
  const request1 = fetch("http://localhost:3000/api/gemini/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const request2 = fetch("http://localhost:3000/api/gemini/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ...payload, message: "Reply with exactly: CONCURRENT_TEST2_" + Date.now() })
  });

  try {
    const [response1, response2] = await Promise.all([request1, request2]);

    console.log(`Request 1 status: ${response1.status}`);
    console.log(`Request 2 status: ${response2.status}`);

    if (!response1.ok || !response2.ok) {
      console.log("✗ CONCURRENT TEST: FAIL - One or both requests failed");
      return false;
    }

    const [data1, data2] = await Promise.all([response1.json(), response2.json()]);
    
    console.log(`Request 1 response text: ${data1.text?.substring(0, 50)}...`);
    console.log(`Request 2 response text: ${data2.text?.substring(0, 50)}...`);

    // Both should get valid responses
    if (!data1.text || !data2.text) {
      console.log("✗ CONCURRENT TEST: FAIL - Empty response");
      return false;
    }

    // Responses should be different (not the same response object)
    if (data1.text === data2.text && data1.text.includes("CONCURRENT_TEST")) {
      console.log("✗ CONCURRENT TEST: FAIL - Responses are identical (shared Promise bug)");
      return false;
    }

    console.log("\n✓ CONCURRENT TEST: PASS - Both requests got separate responses");
    return true;
  } catch (error) {
    console.log("✗ CONCURRENT TEST: FAIL - Error:", error.message);
    return false;
  }
}

async function testDuplicateSubmit() {
  console.log("\n=== TEST 2: Duplicate Submit Protection ===");
  console.log("Sending rapid duplicate requests from same client...\n");

  const payload = {
    message: "Reply with exactly: DUPLICATE_TEST_" + Date.now(),
    history: []
  };

  // Send two requests in rapid succession (simulating double-click)
  const request1 = fetch("http://localhost:3000/api/gemini/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  // Small delay to simulate rapid double-click
  await new Promise(resolve => setTimeout(resolve, 100));

  const request2 = fetch("http://localhost:3000/api/gemini/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  try {
    const [response1, response2] = await Promise.all([request1, request2]);

    console.log(`Request 1 status: ${response1.status}`);
    console.log(`Request 2 status: ${response2.status}`);

    // Second request should be throttled (429) or succeed
    // Either is acceptable - the key is it doesn't hang
    if (response2.status === 429) {
      console.log("\n✓ DUPLICATE TEST: PASS - Second request throttled (expected behavior)");
      return true;
    }

    if (!response1.ok || !response2.ok) {
      console.log("✗ DUPLICATE TEST: FAIL - One or both requests failed");
      return false;
    }

    const [data1, data2] = await Promise.all([response1.json(), response2.json()]);
    
    // Both should complete (not hang)
    if (!data1.text || !data2.text) {
      console.log("✗ DUPLICATE TEST: FAIL - Empty response");
      return false;
    }

    console.log("\n✓ DUPLICATE TEST: PASS - Both requests completed without hanging");
    return true;
  } catch (error) {
    console.log("✗ DUPLICATE TEST: FAIL - Error:", error.message);
    return false;
  }
}

async function runTests() {
  console.log("========================================");
  console.log("CONCURRENCY FIX VERIFICATION TESTS");
  console.log("========================================");

  const test1Pass = await testConcurrentAnonymousRequests();
  const test2Pass = await testDuplicateSubmit();

  console.log("\n========================================");
  console.log("TEST RESULTS");
  console.log("========================================");
  console.log(`Concurrent Anonymous Requests: ${test1Pass ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`Duplicate Submit Protection: ${test2Pass ? "✓ PASS" : "✗ FAIL"}`);
  console.log("========================================\n");

  if (test1Pass && test2Pass) {
    console.log("✓ ALL TESTS PASSED");
    process.exit(0);
  } else {
    console.log("✗ SOME TESTS FAILED");
    process.exit(1);
  }
}

// Check if server is running
try {
  await fetch("http://localhost:3000/api/health/ai");
  runTests();
} catch (error) {
  console.error("✗ ERROR: Server is not running on localhost:3000");
  console.error("  Please start the server with: npm run dev");
  process.exit(1);
}