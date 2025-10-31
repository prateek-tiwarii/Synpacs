import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Home } from '@/pages/Home'
import { About } from '@/pages/About'
import { Auth } from '@/pages/Auth'
import Dashboard from './pages/Dashboard'
import { Worklist } from '@/pages/Worklist'
import { PacList } from '@/pages/PacList'
import { Automation } from '@/pages/Automation'

import { NotFound } from '@/pages/NotFound'
import { Navigation } from '@/components/Navigation'
import './App.css'
import Settings from './pages/Settings'

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes with Navigation */}
        <Route
          path="/"
          element={
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <main className="flex-1 mt-16">
                <Home />
              </main>
            </div>
          }
        />
        <Route
          path="/about"
          element={
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <main className="flex-1 mt-16">
                <About />
              </main>
            </div>
          }
        />
        <Route
          path="/auth"
          element={
            <div className="flex flex-col min-h-screen">
              <Navigation />
              <main className="flex-1 mt-16">
                <Auth />
              </main>
            </div>
          }
        />

        {/* Dashboard Routes with Navbar */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/worklist" element={<Worklist />} />
        <Route path="/pac-list" element={<PacList />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/settings" element={<Settings/>} />

        {/* Redirect root to dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  )
}

export default App
