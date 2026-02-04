/**
 * Test utilities: custom render with React Query and Feedback providers for a11y and other tests
 */

import { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeedbackProvider } from "@/contexts/FeedbackContext";

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: AllTheProvidersProps): ReactElement {
  const client = createTestQueryClient();
  return (
    <QueryClientProvider client={client}>
      <FeedbackProvider>
        {children}
      </FeedbackProvider>
    </QueryClientProvider>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): ReturnType<typeof render> {
  return render(ui, {
    wrapper: AllTheProviders,
    ...options,
  });
}

export { customRender as render, createTestQueryClient };
export { screen, waitFor, within } from "@testing-library/react";
