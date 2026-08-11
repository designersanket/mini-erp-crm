import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

interface Note {
  id: number;
  note: string;
  followup_date: string | null;
  created_by_name: string | null;
  created_at: string;
}

interface CustomerData {
  id: number; name: string; mobile: string; email: string | null; business_name: string | null;
  gst_number: string | null; customer_type: string; address: string | null; status: string;
  followup_date: string | null; notes: string | null; notes_list?: Note[];
  notes_arr?: Note[]; notesData?: Note[]; [key: string]: any;
}

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newFollowup, setNewFollowup] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.get(`/customers/${id}`);
    setCustomer(res.data.data);
    setNotes(res.data.data.notes || []);
  }

  useEffect(() => { load(); }, [id]);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    setSavingNote(true);
    setError(null);
    try {
      await api.post(`/customers/${id}/notes`, {
        note: newNote,
        followup_date: newFollowup || undefined,
      });
      setNewNote('');
      setNewFollowup('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add note');
    } finally {
      setSavingNote(false);
    }
  }

  if (!customer) return <p className="muted">Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <p className="subtitle"><Link to="/customers">&larr; Back to customers</Link></p>
          <h1>{customer.name}</h1>
        </div>
        <button className="btn secondary" onClick={() => setEditing((e) => !e)}>
          {editing ? 'Cancel edit' : 'Edit customer'}
        </button>
      </div>

      {editing ? (
        <EditCustomerForm customer={customer} onSaved={() => { setEditing(false); load(); }} />
      ) : (
        <div className="card">
          <div className="form-grid">
            <Field label="Mobile" value={customer.mobile} />
            <Field label="Email" value={customer.email || '—'} />
            <Field label="Business name" value={customer.business_name || '—'} />
            <Field label="GST number" value={customer.gst_number || '—'} />
            <Field label="Type" value={<span className={`badge ${customer.customer_type}`}>{customer.customer_type}</span>} />
            <Field label="Status" value={<span className={`badge ${customer.status}`}>{customer.status}</span>} />
            <Field label="Next follow-up" value={customer.followup_date || '—'} />
            <Field label="Address" value={customer.address || '—'} />
          </div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Follow-up notes</h3>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={addNote} style={{ marginBottom: 20 }}>
          <div className="form-field" style={{ marginBottom: 10 }}>
            <label>Add a note</label>
            <textarea rows={2} value={newNote} onChange={(e) => setNewNote(e.target.value)} required />
          </div>
          <div className="toolbar">
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Set next follow-up date (optional)</label>
              <input type="date" value={newFollowup} onChange={(e) => setNewFollowup(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={savingNote} style={{ alignSelf: 'flex-end' }}>
              {savingNote ? 'Saving...' : 'Add note'}
            </button>
          </div>
        </form>

        {notes.length === 0 ? (
          <p className="muted">No follow-up notes yet.</p>
        ) : (
          <table>
            <thead><tr><th>Note</th><th>Follow-up date</th><th>By</th><th>When</th></tr></thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id}>
                  <td>{n.note}</td>
                  <td>{n.followup_date || '—'}</td>
                  <td>{n.created_by_name || '—'}</td>
                  <td>{new Date(n.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="form-field">
      <label>{label}</label>
      <div>{value}</div>
    </div>
  );
}

function EditCustomerForm({ customer, onSaved }: { customer: CustomerData; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: customer.name, mobile: customer.mobile, email: customer.email || '',
    business_name: customer.business_name || '', gst_number: customer.gst_number || '',
    customer_type: customer.customer_type, address: customer.address || '',
    status: customer.status, followup_date: customer.followup_date || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.put(`/customers/${customer.id}`, form);
      onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="form-field">
            <label>Customer name</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Mobile number</label>
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
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
