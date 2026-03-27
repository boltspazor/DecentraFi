import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { config } from './config/wagmiConfig'
import App from './App'
import './index.css'
import { assertNetworkSafety } from "./utils/networkSafety";
import { ThemeProvider } from "./context/ThemeContext";

const queryClient = new QueryClient()

assertNetworkSafety();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  </StrictMode>,
)
