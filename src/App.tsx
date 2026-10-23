import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  BoltIcon,
  CodeIcon,
  EyeIcon,
  HelpIcon,
  NfcIcon,
  PenIcon,
  SlidersIcon,
} from './components/Icons'
import { WritePage } from './pages/WritePage'
import { ReadPage } from './pages/ReadPage'
import { FlashPage } from './pages/FlashPage'
import { FirmwarePage } from './pages/FirmwarePage'
import { SetupPage } from './pages/SetupPage'
import { HelpPage } from './pages/HelpPage'

const NAV = [
  { to: '/write', label: 'Write', end: false, icon: <PenIcon size={17} /> },
  { to: '/read', label: 'Read', end: false, icon: <EyeIcon size={17} /> },
  { to: '/flash', label: 'Flash', end: false, icon: <BoltIcon size={17} /> },
  { to: '/firmware', label: 'Firmware', end: false, icon: <CodeIcon size={17} /> },
  { to: '/setup', label: 'Setup', end: false, icon: <SlidersIcon size={17} /> },
  { to: '/help', label: 'Help', end: false, icon: <HelpIcon size={17} /> },
] as const

export function App() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar">
        <Link to="/write" className="brand">
          <span className="brand__mark">
            <NfcIcon size={18} />
          </span>
          NFC Writer
        </Link>

        <nav className="sidebar__nav" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}
            >
              <span className="side-link__icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="side-link__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <span>Runs locally in your browser.</span>
          <span>ESP32 · RC522 · NTAG</span>
        </div>
      </aside>

      <main id="main" className="app-main">
        <div className="container">
          <Routes>
            <Route path="/" element={<Navigate to="/write" replace />} />
            <Route path="/write" element={<WritePage />} />
            <Route path="/read" element={<ReadPage />} />
            <Route path="/flash" element={<FlashPage />} />
            <Route path="/firmware" element={<FirmwarePage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="*" element={<Navigate to="/write" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
