import serverless from "serverless-http";
import { app } from "../../app";

// Express wrapper that intercepts AWS Lambda events from Netlify Functions
const serverlessHandler = serverless(app, {
  request(request, event, context) {
    // Retain full reference to the original request headers and body
    // If Netlify prefix is present, normalize it to standard '/api' path
    if (request.url.startsWith("/.netlify/functions/api")) {
      request.url = request.url.replace("/.netlify/functions/api", "/api");
    } else if (request.url.startsWith("/.netlify/functions")) {
      request.url = request.url.replace("/.netlify/functions", "/api");
    }
    return request;
  }
});

export const handler = async (event: any, context: any) => {
  // Ensure the body is passed as a string or parsed correctly by body-parser middlewares
  return await serverlessHandler(event, context);
};
