import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Stats {
  customers: number;
  activeCustomers: number;
  products: number;
  lowStockProducts: number;
  draftChallans: number;
  confirmedChallans: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [customersRes, activeRes, productsRes, lowStockRes, draftRes, confirmedRes] = await Promise.all([
          api.get('/customers?limit=1'),
          api.get('/customers?limit=1&status=active'),
          api.get('/products?limit=1'),
          api.get('/products?limit=1&low_stock=true'),
          api.get('/challans?limit=1&status=draft'),
          api.get('/challans?limit=1&status=confirmed'),
        ]);
        setStats({
          customers: customersRes.data.pagination.total,
          activeCustomers: activeRes.data.pagination.total,
          products: productsRes.data.pagination.total,
          lowStockProducts: lowStockRes.data.pagination.total,
          draftChallans: draftRes.data.pagination.total,
          confirmedChallans: confirmedRes.data.pagination.total,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="subtitle">Here's what's happening across the operation today.</p>
        </div>
      </div>

      {loading || !stats ? (
        <p className="muted">Loading dashboard...</p>
      ) : (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="value">{stats.customers}</div>
            <div className="label">Total customers</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.activeCustomers}</div>
            <div className="label">Active customers</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.products}</div>
            <div className="label">Products tracked</div>
          </div>
          <div className="stat-card">
            <div className="value" style={{ color: stats.lowStockProducts > 0 ? 'var(--danger)' : undefined }}>
              {stats.lowStockProducts}
            </div>
            <div className="label">Low stock alerts</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.draftChallans}</div>
            <div className="label">Draft challans</div>
          </div>
          <div className="stat-card">
            <div className="value">{stats.confirmedChallans}</div>
            <div className="label">Confirmed challans</div>
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your role: {user?.role}</h3>
        <p className="muted" style={{ margin: 0 }}>
          Use the sidebar to manage customers, product stock, and sales challans. Admins can also manage
          user accounts under &ldquo;Users&rdquo;.
        </p>
      </div>
    </div>
  );
}
