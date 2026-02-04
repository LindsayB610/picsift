/**
 * Logout this device only: remove this device's session from Blob and clear session cookie.
 * Other devices (e.g. phone) remain logged in.
 */

import {
  clearSessionCookieHeader,
  getSessionCookieFromEvent,
  removeSessionFromBlob,
} from "./_auth_store";

type HandlerEvent = {
  httpMethod: string;
  headers: Record<string, string>;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

export const handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const sessionCookie = getSessionCookieFromEvent(event);
  await removeSessionFromBlob(sessionCookie);
  const isSecure =
    (event.headers["x-forwarded-proto"] || "").toLowerCase() === "https";
  const clearCookie = clearSessionCookieHeader(isSecure);
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearCookie,
    },
    body: JSON.stringify({ success: true }),
  };
};
