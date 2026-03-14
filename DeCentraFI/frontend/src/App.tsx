import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Home } from './pages/Home'
import { CreateCampaign } from './pages/CreateCampaign'
import { CampaignDetail } from './pages/CampaignDetail'
import { CampaignExplorePage } from './pages/CampaignExplore'
import { Dashboard } from './pages/Dashboard'
import { AdminDashboard } from './pages/AdminDashboard'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/explore" element={<CampaignExplorePage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
