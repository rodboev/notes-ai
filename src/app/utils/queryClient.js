// src/app/utils/queryClient.js

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000, // 15 min
      cacheTime: Infinity,
    },
  },
})
