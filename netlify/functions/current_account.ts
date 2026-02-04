/**
 * Setup helper: returns the Dropbox account ID and email for the configured
 * DROPBOX_REFRESH_TOKEN. Use this to get the value for AUTHORIZED_DROPBOX_ACCOUNT_ID
 * in Netlify (Site configuration → Environment variables).
 *
 * Call: GET /.netlify/functions/current_account
 * Requires: DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN set.
 */

import { getCurrentAccountForSetup } from "./_dropbox";
import { normalizeError } from "./_utils";

type HandlerEvent = {
  httpMethod: string;
};

type HandlerResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body?: string;
};

export const handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { account_id, email } = await getCurrentAccountForSetup();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id,
        email,
        hint: "Set AUTHORIZED_DROPBOX_ACCOUNT_ID to the account_id value in Netlify → Site configuration → Environment variables.",
      }),
    };
  } catch (err: unknown) {
    const message = normalizeError(err);
    console.error("[CURRENT_ACCOUNT] Error:", message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to get current account",
        message,
      }),
    };
  }
};
