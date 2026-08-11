import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

interface Customer {
  id: number;
  name: string;
  mobile: string;
  business_name: string | null;
  customer_type: string;
  status: string;
  followup_date: string | null;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '10' };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.data);
      setTotalPages(res.data.pagination.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="subtitle">Manage leads, active accounts, and follow-ups.</p>
        </div>
        <button className="btn" onClick={() => setShowForm(true)}>+ Add customer</button>
      </div>

      {showForm && <NewCustomerForm onClose={() => setShowForm(false)} onCreated={load} />}

      <div className="card">
        <form className="toolbar" onSubmit={handleSearchSubmit}>
          <input
            placeholder="Search name, mobile, email, business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="btn secondary" type="submit">Search</button>
        </form>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : customers.length === 0 ? (
          <div className="empty-state">No customers found.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Business</th>
                  <th>Mobile</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Next follow-up</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/customers/${c.id}`}>{c.name}</Link></td>
                    <td>{c.business_name || '—'}</td>
                    <td>{c.mobile}</td>
                    <td><span className={`badge ${c.customer_type}`}>{c.customer_type}</span></td>
                    <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                    <td>{c.followup_date || '—'}</td>
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

function NewCustomerForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', mobile: '', email: '', business_name: '', gst_number: '',
    customer_type: 'retail', address: '', status: 'lead', followup_date: '', notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post('/customers', {
        ...form,
        email: form.email || undefined,
        followup_date: form.followup_date || undefined,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>New customer</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Customer name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Mobile number *</label>
            <input value={form.mobile} onChange={(e) => set('mobile', e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Business name</label>
            <input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} />
          </div>
          <div className="form-field">
            <label>GST number</label>
            <input value={form.gst_number} onChange={(e) => set('gst_number', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Customer type</label>
            <select value={form.customer_type} onChange={(e) => set('customer_type', e.target.value)}>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="distributor">Distributor</option>
            </select>
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="lead">Lead</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="form-field">
            <label>Follow-up date</label>
            <input type="date" value={form.followup_date} onChange={(e) => set('followup_date', e.target.value)} />
          </div>
          <div className="form-field full">
            <label>Address</label>
            <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
          <div className="form-field full">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save customer'}</button>
          <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
