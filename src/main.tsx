import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'

const root = document.getElementById('root')
if (root == null) {
  throw new Error('Root element #root not found')
}

// Create a client with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000, // 1 hour - folders don't change often
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 1, // Retry once on failure
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    },
  },
})

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
