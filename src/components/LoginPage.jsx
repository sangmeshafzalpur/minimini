import React, { useState } from 'react';
import './LoginPage.css';
import { useNavigate } from "react-router-dom"; 

// Admin credentials
const ADMIN_CREDENTIALS = [
  { username: 'superadmin', password: 'SuperAdmin@123', role: 'Super Admin' },
  { username: 'admin1', password: 'Admin1@pass', role: 'Admin' },
  { username: 'admin2', password: 'Admin2@pass', role: 'Admin' },
  { username: 'admin3', password: 'Admin3@pass', role: 'Admin' },
];

const LoginPage = () => {
    const navigate = useNavigate(); 
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e. target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError('');
  };

  const handleLogin = (e) => {
    e. preventDefault();
    setIsLoading(true);
    setError('');

    // Simulate API call delay
    setTimeout(() => {
      const admin = ADMIN_CREDENTIALS.find(
        (cred) => cred.username === formData.username && cred.password === formData. password
      );

      if (admin) {
        setUser({
          username: admin.username,
          role: admin.role,
        });
        setFormData({ username: '', password: '' });
        console.log('Login successful:', admin);
         navigate("/dashboard"); 
      } else {
        setError('Invalid username or password');
      }
      setIsLoading(false);
    }, 1000);
  };

  const handleLogout = () => {
    setUser(null);
    setFormData({ username: '', password: '' });
    setError('');
  };

  if (user) {
    return (
      <div className="login-container">
        <div className="success-card">
          <div className="success-icon">✓</div>
          <h2>Welcome, {user.username}!</h2>
          <p className="role-badge">{user.role}</p>
          <p>You have successfully logged in.</p>
          <button className="Ok-btn">
            OK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Login</h1>
          <p className="subtitle">Access for Super Admin and Admin</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your username"
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Logging in.. .' : 'Login'}
          </button>
        </form>

        
      </div>
    </div>
  );
};

export default LoginPage;