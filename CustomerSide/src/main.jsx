import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

import App from './App.jsx'
import CarsPage from './CarsPage.jsx'
import CalendarBookingPage from './CalendarBookingPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/cars" element={<CarsPage />} />
        <Route path="/calendar-booking" element={<CalendarBookingPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
