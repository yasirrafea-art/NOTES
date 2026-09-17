import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Tasks from './pages/Tasks'
import Notes from './pages/Notes'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Search from './pages/Search'
import Log from './pages/Log'

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/log" element={<Log />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}