import React from 'react'
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'
import TimetableGenerator from './components/TimetableGenerator'
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"; 
function App() {

  return (
    <Router>
      <Routes>
        {/* Default route opens Login */}
        <Route path="/" element={<Navigate to="/login" />} />

        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard Route */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/TimetableGenerator" element={<TimetableGenerator />} />
      </Routes>
    </Router>
    
  );
};

export default App
