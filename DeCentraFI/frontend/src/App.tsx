import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppBackground } from './components/AppBackground'
import { Navbar } from './components/Navbar'
import { Home } from './pages/Home'
import { CreateCampaign } from './pages/CreateCampaign'
import { CampaignDetail } from './pages/CampaignDetail'
import { CampaignExplorePage } from './pages/CampaignExplore'
import { Dashboard } from './pages/Dashboard'
import { AdminDashboard } from './pages/AdminDashboard'
import { CreatorProfile } from './pages/CreatorProfile'

function App() {
  return (
    <BrowserRouter>
      <AppBackground />
      <Navbar />
      <main className="relative z-10 min-h-[calc(100vh-4rem)] pb-12 sm:pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/explore" element={<CampaignExplorePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/creators/:wallet" element={<CreatorProfile />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
