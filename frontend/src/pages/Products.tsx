import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: number; name: string; sku: string; category: string | null;
  unit_price: number; current_stock: number; min_stock_alert: number; location: string | null;
}

interface Movement {
  id: number; quantity: number; movement_type: 'IN' | 'OUT'; reason: string | null;
  created_by_name: string | null; created_at: string;
}

export default function Products() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'warehouse';

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [movementsFor, setMovementsFor] = useState<Product | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '10' };
      if (search) params.search = search;
      if (lowStockOnly) params.low_stock = 'true';
      const res = await api.get('/products', { params });
      setProducts(res.data.data);
      setTotalPages(res.data.pagination.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lowStockOnly]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Products & Stock</h1>
          <p className="subtitle">Track inventory levels and stock movements.</p>
        </div>
        {canManage && <button className="btn" onClick={() => setShowForm(true)}>+ Add product</button>}
      </div>

      {showForm && <NewProductForm onClose={() => setShowForm(false)} onCreated={load} />}
      {movementsFor && <MovementsPanel product={movementsFor} canManage={!!canManage} onClose={() => setMovementsFor(null)} onChanged={load} />}

      <div className="card">
        <div className="toolbar">
          <input
            placeholder="Search name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), load())}
            style={{ minWidth: 260 }}
          />
          <button className="btn secondary" onClick={() => { setPage(1); load(); }}>Search</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400, color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }} />
            Low stock only
          </label>
        </div>

        {loading ? (
          <p className="muted">Loading...</p>
        ) : products.length === 0 ? (
          <div className="empty-state">No products found.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Location</th><th></th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td>{p.category || '—'}</td>
                    <td>₹{Number(p.unit_price).toFixed(2)}</td>
                    <td>
                      <span style={{ color: p.current_stock <= p.min_stock_alert ? 'var(--danger)' : undefined, fontWeight: 600 }}>
                        {p.current_stock}
                      </span>
                      {p.current_stock <= p.min_stock_alert && <span className="badge inactive" style={{ marginLeft: 8 }}>Low</span>}
                    </td>
                    <td>{p.location || '—'}</td>
                    <td><button className="btn secondary small" onClick={() => setMovementsFor(p)}>Stock log</button></td>
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

function NewProductForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', sku: '', category: '', unit_price: '', current_stock: '0', min_stock_alert: '0', location: '',
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
      await api.post('/products', {
        ...form,
        unit_price: parseFloat(form.unit_price || '0'),
        current_stock: parseInt(form.current_stock || '0', 10),
        min_stock_alert: parseInt(form.min_stock_alert || '0', 10),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>New product</h3>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Product name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="form-field">
            <label>SKU / code *</label>
            <input value={form.sku} onChange={(e) => set('sku', e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Category</label>
            <input value={form.category} onChange={(e) => set('category', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Unit price *</label>
            <input type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Opening stock</label>
            <input type="number" min="0" value={form.current_stock} onChange={(e) => set('current_stock', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Minimum stock alert</label>
            <input type="number" min="0" value={form.min_stock_alert} onChange={(e) => set('min_stock_alert', e.target.value)} />
          </div>
          <div className="form-field">
            <label>Location / warehouse</label>
            <input value={form.location} onChange={(e) => set('location', e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save product'}</button>
          <button className="btn secondary" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

function MovementsPanel({ product, canManage, onClose, onChanged }: {
  product: Product; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState('');
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/products/${product.id}/movements`);
      setMovements(res.data.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [product.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/products/${product.id}/movements`, {
        quantity: parseInt(qty, 10),
        movement_type: type,
        reason: reason || undefined,
      });
      setQty('');
      setReason('');
      await load();
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to record movement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="page-header" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Stock log &mdash; {product.name} ({product.sku})</h3>
        <button className="btn secondary small" onClick={onClose}>Close</button>
      </div>

      {canManage && (
        <form onSubmit={submit} className="toolbar" style={{ marginBottom: 16 }}>
          {error && <div className="error-banner" style={{ width: '100%' }}>{error}</div>}
          <select value={type} onChange={(e) => setType(e.target.value as 'IN' | 'OUT')}>
            <option value="IN">Stock IN</option>
            <option value="OUT">Stock OUT</option>
          </select>
          <input type="number" min="1" placeholder="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} required style={{ width: 110 }} />
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minWidth: 200 }} />
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Record movement'}</button>
        </form>
      )}

      {loading ? (
        <p className="muted">Loading...</p>
      ) : movements.length === 0 ? (
        <div className="empty-state">No stock movements recorded yet.</div>
      ) : (
        <table>
          <thead><tr><th>Type</th><th>Qty</th><th>Reason</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td><span className={`badge ${m.movement_type.toLowerCase()}`}>{m.movement_type}</span></td>
                <td>{m.quantity}</td>
                <td>{m.reason || '—'}</td>
                <td>{m.created_by_name || '—'}</td>
                <td>{new Date(m.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
