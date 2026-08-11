import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

interface Item {
  id: number; product_name_snapshot: string; product_sku_snapshot: string;
  unit_price_snapshot: number; quantity: number;
}
interface ChallanData {
  id: number; challan_number: string; status: string; total_quantity: number;
  customer_name: string; customer_mobile: string; customer_address: string | null;
  created_at: string; confirmed_at: string | null; cancelled_at: string | null;
  items: Item[];
}

export default function ChallanDetail() {
  const { id } = useParams();
  const [challan, setChallan] = useState<ChallanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    const res = await api.get(`/challans/${id}`);
    setChallan(res.data.data);
  }

  useEffect(() => { load(); }, [id]);

  async function confirmChallan() {
    setActing(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/challans/${id}/confirm`);
      setMessage('Challan confirmed. Stock has been reduced.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to confirm challan');
    } finally {
      setActing(false);
    }
  }

  async function cancelChallan() {
    if (!window.confirm('Cancel this challan? If it was confirmed, stock will be restored.')) return;
    setActing(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/challans/${id}/cancel`);
      setMessage('Challan cancelled.');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to cancel challan');
    } finally {
      setActing(false);
    }
  }

  if (!challan) return <p className="muted">Loading...</p>;

  const total = challan.items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price_snapshot), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="subtitle"><Link to="/challans">&larr; Back to challans</Link></p>
          <h1>{challan.challan_number}</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {challan.status === 'draft' && (
            <button className="btn success" onClick={confirmChallan} disabled={acting}>
              {acting ? 'Working...' : 'Confirm challan'}
            </button>
          )}
          {challan.status !== 'cancelled' && (
            <button className="btn danger" onClick={cancelChallan} disabled={acting}>
              {acting ? 'Working...' : 'Cancel challan'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <div className="card">
        <div className="form-grid">
          <div className="form-field">
            <label>Status</label>
            <span className={`badge ${challan.status}`}>{challan.status}</span>
          </div>
          <div className="form-field">
            <label>Customer</label>
            <div>{challan.customer_name} ({challan.customer_mobile})</div>
          </div>
          <div className="form-field">
            <label>Created</label>
            <div>{new Date(challan.created_at).toLocaleString()}</div>
          </div>
          <div className="form-field">
            <label>{challan.status === 'confirmed' ? 'Confirmed at' : challan.status === 'cancelled' ? 'Cancelled at' : 'Total quantity'}</label>
            <div>
              {challan.status === 'confirmed' && challan.confirmed_at
                ? new Date(challan.confirmed_at).toLocaleString()
                : challan.status === 'cancelled' && challan.cancelled_at
                ? new Date(challan.cancelled_at).toLocaleString()
                : challan.total_quantity}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Line items</h3>
        <table>
          <thead>
            <tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Qty</th><th className="text-right">Line total</th></tr>
          </thead>
          <tbody>
            {challan.items.map((it) => (
              <tr key={it.id}>
                <td>{it.product_name_snapshot}</td>
                <td>{it.product_sku_snapshot}</td>
                <td>₹{Number(it.unit_price_snapshot).toFixed(2)}</td>
                <td>{it.quantity}</td>
                <td className="text-right">₹{(it.quantity * Number(it.unit_price_snapshot)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: 12, fontWeight: 700 }}>
          Total: ₹{total.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
