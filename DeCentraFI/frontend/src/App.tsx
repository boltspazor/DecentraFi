import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Home } from './pages/Home'
import { CreateCampaign } from './pages/CreateCampaign'
import { CampaignDetail } from './pages/CampaignDetail'
import { CampaignExplorePage } from './pages/CampaignExplore'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/explore" element={<CampaignExplorePage />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
