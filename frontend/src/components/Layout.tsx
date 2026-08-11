import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Mini ERP + CRM</div>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
          <NavLink to="/customers" className={({ isActive }) => (isActive ? 'active' : '')}>Customers</NavLink>
          <NavLink to="/products" className={({ isActive }) => (isActive ? 'active' : '')}>Products & Stock</NavLink>
          <NavLink to="/challans" className={({ isActive }) => (isActive ? 'active' : '')}>Sales Challans</NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/users" className={({ isActive }) => (isActive ? 'active' : '')}>Users</NavLink>
          )}
        </nav>
        <div className="user-box">
          <div>{user?.name}</div>
          <div className="muted" style={{ fontSize: 12 }}>{user?.email}</div>
          <span className="role-badge">{user?.role}</span>
          <button className="logout" onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
