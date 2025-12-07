import React from 'react' 
import LoginPage from './components/LoginPage'
import Dashboard from './components/Dashboard'
import TimetableGenerator from './components/TimetableGenerator'
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from './authContext';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

function App() {

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Default route opens Login */}
          <Route path="/" element={<Navigate to="/login" />} />

          <Route path="/login" element={<LoginPage />} />

          {/* Dashboard Route */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/TimetableGenerator" element={
            <ProtectedRoute>
              <TimetableGenerator />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>

  );
};

export default App
