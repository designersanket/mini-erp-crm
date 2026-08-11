import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

interface Customer { id: number; name: string; mobile: string; }
interface Product { id: number; name: string; sku: string; unit_price: number; current_stock: number; }
interface LineItem { product_id: number | ''; quantity: string; }

export default function ChallanNew() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [items, setItems] = useState<LineItem[]>([{ product_id: '', quantity: '1' }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadRefs() {
      const [custRes, prodRes] = await Promise.all([
        api.get('/customers', { params: { limit: 100 } }),
        api.get('/products', { params: { limit: 100 } }),
      ]);
      setCustomers(custRes.data.data);
      setProducts(prodRes.data.data);
    }
    loadRefs();
  }, []);

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: field === 'product_id' ? Number(value) : value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: '', quantity: '1' }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function productFor(id: number | '') {
    return products.find((p) => p.id === id);
  }

  async function submit(status: 'draft' | 'confirmed') {
    setError(null);
    if (!customerId) { setError('Please select a customer'); return; }
    const validItems = items.filter((it) => it.product_id !== '' && Number(it.quantity) > 0);
    if (!validItems.length) { setError('Add at least one product line item'); return; }

    setSaving(true);
    try {
      const res = await api.post('/challans', {
        customer_id: customerId,
        items: validItems.map((it) => ({ product_id: it.product_id, quantity: Number(it.quantity) })),
        status,
      });
      navigate(`/challans/${res.data.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create challan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>New sales challan</h1>
          <p className="subtitle">Select a customer, add products, then save as draft or confirm to dispatch stock.</p>
        </div>
      </div>

      <div className="card">
        {error && <div className="error-banner">{error}</div>}

        <div className="form-field" style={{ maxWidth: 360, marginBottom: 20 }}>
          <label>Customer *</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select a customer...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.mobile})</option>
            ))}
          </select>
        </div>

        <table className="line-items-table">
          <thead>
            <tr><th>Product</th><th>Available stock</th><th>Quantity</th><th></th></tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const product = productFor(item.product_id);
              const insufficient = product && Number(item.quantity) > product.current_stock;
              return (
                <tr key={idx}>
                  <td>
                    <select value={item.product_id} onChange={(e) => updateItem(idx, 'product_id', e.target.value)}>
                      <option value="">Select product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku}) — ₹{Number(p.unit_price).toFixed(2)}</option>
                      ))}
                    </select>
                  </td>
                  <td>{product ? product.current_stock : '—'}</td>
                  <td>
                    <input
                      type="number" min="1" value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                      style={{ borderColor: insufficient ? 'var(--danger)' : undefined }}
                    />
                    {insufficient && <div style={{ color: 'var(--danger)', fontSize: 12 }}>Exceeds available stock</div>}
                  </td>
                  <td>
                    {items.length > 1 && (
                      <button type="button" className="btn secondary small" onClick={() => removeItem(idx)}>Remove</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" className="btn secondary small" onClick={addItem} style={{ marginTop: 10 }}>+ Add line item</button>

        <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
          <button className="btn secondary" onClick={() => submit('draft')} disabled={saving}>
            {saving ? 'Saving...' : 'Save as draft'}
          </button>
          <button className="btn success" onClick={() => submit('confirmed')} disabled={saving}>
            {saving ? 'Saving...' : 'Save & confirm (reduces stock)'}
          </button>
        </div>
      </div>
    </div>
  );
}
