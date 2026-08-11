import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Challan {
  id: number; challan_number: string; customer_name: string; customer_mobile: string;
  status: string; total_quantity: number; created_at: string;
}

export default function Challans() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '10' };
      if (status) params.status = status;
      const res = await api.get('/challans', { params });
      setChallans(res.data.data);
      setTotalPages(res.data.pagination.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sales Challans</h1>
          <p className="subtitle">Create, confirm, and track outgoing sales challans.</p>
        </div>
        <Link className="btn" to="/challans/new">+ New challan</Link>
      </div>

      <div className="card">
        <div className="toolbar">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : challans.length === 0 ? (
          <div className="empty-state">No challans found.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr><th>Challan #</th><th>Customer</th><th>Qty</th><th>Status</th><th>Created</th></tr>
              </thead>
              <tbody>
                {challans.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/challans/${c.id}`}>{c.challan_number}</Link></td>
                    <td>{c.customer_name} <span className="muted">({c.customer_mobile})</span></td>
                    <td>{c.total_quantity}</td>
                    <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                    <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pagination">
              <span>Page {page} of {totalPages}</span>
              <button className="btn secondary small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
              <button className="btn secondary small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
