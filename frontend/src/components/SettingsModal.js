// HEADY_BRAND:BEGIN
// ╔══════════════════════════════════════════════════════════════════╗
// ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
// ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
// ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
// ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
// ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
// ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
// ║                                                                  ║
// ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
// ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
// ║  FILE: frontend/src/components/SettingsModal.js                                                    ║
// ║  LAYER: ui/frontend                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
// HEADY_BRAND:END

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '../utils/auth';

const SettingsModal = ({ onClose }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = getToken();

  useEffect(() => {
    axios.get('/api/settings', { headers: { 'X-Admin-Token': token } })
      .then(res => {
        setSettings(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [token]);

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      remote_gpu: {
        ...prev.remote_gpu,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      await axios.post('/api/settings', settings, { headers: { 'X-Admin-Token': token } });
      onClose();
    } catch (err) {
      alert("Failed to save settings");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{ backgroundColor: '#252526', padding: '20px', borderRadius: '5px', width: '400px', color: '#ccc' }}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>

        <div style={{ marginBottom: '15px' }}>
            <h4 style={{ marginBottom: '10px' }}>Remote GPU</h4>
            <label style={{ display: 'block', marginBottom: '5px' }}>
                <input
                    type="checkbox"
                    checked={settings?.remote_gpu?.enabled || false}
                    onChange={e => handleChange('enabled', e.target.checked)}
                /> Enable Remote GPU
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <label>
                    Host:
                    <input
                        type="text"
                        value={settings?.remote_gpu?.host || ''}
                        onChange={e => handleChange('host', e.target.value)}
                        style={{ width: '100%', backgroundColor: '#333', color: '#fff', border: '1px solid #555' }}
                    />
                </label>
                <label>
                    Port:
                    <input
                        type="number"
                        value={settings?.remote_gpu?.port || 8000}
                        onChange={e => handleChange('port', parseInt(e.target.value))}
                        style={{ width: '100%', backgroundColor: '#333', color: '#fff', border: '1px solid #555' }}
                    />
                </label>
            </div>
            <label style={{ display: 'block', marginTop: '10px' }}>
                Memory Limit:
                <input
                    type="text"
                    value={settings?.remote_gpu?.memory_limit || ''}
                    onChange={e => handleChange('memory_limit', e.target.value)}
                    style={{ width: '100%', backgroundColor: '#333', color: '#fff', border: '1px solid #555' }}
                />
            </label>
             <label style={{ display: 'block', marginTop: '5px' }}>
                <input
                    type="checkbox"
                    checked={settings?.remote_gpu?.use_rdma || false}
                    onChange={e => handleChange('use_rdma', e.target.checked)}
                /> Use GPUDirect RDMA
            </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={onClose} style={{ padding: '5px 10px', backgroundColor: '#555', color: '#fff', border: 'none', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSave} style={{ padding: '5px 10px', backgroundColor: '#007acc', color: '#fff', border: 'none', cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
