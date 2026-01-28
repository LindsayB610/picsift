/**
 * Minimal health-check function for Phase 1 setup.
 * Used to verify Netlify Functions build and deployment.
 */

type HandlerEvent = {
  httpMethod: string;
  path: string;
};

type HandlerResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
};

export const handler = async (
  _event: HandlerEvent,
): Promise<HandlerResponse> => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "ok" }),
});
