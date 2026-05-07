/**
 * SalesBee™ Dashboard Logic
 * Autonomously fetches and visualizes monetization leads.
 */

const API_BASE = '/api/monetization';

async function initDashboard() {
    console.log('🐝 [SalesBee] Initializing dashboard...');
    
    await fetchStats();
    await fetchLeads();
    renderMockChart();

    document.getElementById('generate-leads-btn').addEventListener('click', handleGenerateLeads);
}

async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const { ok, data } = await response.json();
        
        if (ok) {
            document.getElementById('stat-total-leads').textContent = data.totalLeads;
            document.getElementById('stat-active-outreach').textContent = data.activeOutreach;
            document.getElementById('stat-conversion-rate').textContent = `${(data.conversionRate * 100).toFixed(1)}%`;
            
            const mrr = parseFloat(data.potentialMRR);
            document.getElementById('stat-potential-mrr').textContent = `$${mrr.toLocaleString()}`;
            
            // ROI Calculation: (Potential Value * Conversion Rate) / Cost (Mocked $1k/mo)
            const roi = ((mrr * data.conversionRate) / 1000 * 100).toFixed(0);
            document.querySelector('.stat-card.highlight .stat-label').textContent = `Potential ROI (${roi}%)`;
        }
    } catch (err) {
        console.error('Failed to fetch stats:', err);
    }
}

async function fetchLeads() {
    try {
        const response = await fetch(`${API_BASE}/leads`);
        const { ok, data } = await response.json();
        
        if (ok) {
            const tbody = document.querySelector('#leads-table tbody');
            tbody.innerHTML = '';
            
            data.forEach(lead => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 600;">${lead.recipient}</div>
                        <div style="font-size: 12px; color: #8892b0;">${lead.subject.split('for ')[1] || 'Enterprise'}</div>
                    </td>
                    <td><div class="avatar" style="width:24px; height:24px; font-size:10px;">${lead.recipient.split(' ')[0][0]}</div></td>
                    <td>${lead.status === 'draft' ? 'Outreach Queue' : 'Negotiating'}</td>
                    <td><span class="badge-status ${lead.status}">${lead.status}</span></td>
                    <td><span class="score-pill">${Math.round(lead.conversionProbability * 500)}</span></td>
                    <td>${new Date(lead.createdAt).toLocaleDateString()}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error('Failed to fetch leads:', err);
    }
}

function renderMockChart() {
    const container = document.getElementById('main-chart');
    const width = container.clientWidth;
    const height = 200;
    
    // Simple SVG Sparkline for visualization
    const points = [10, 40, 25, 60, 45, 90, 70, 100, 85, 120, 105, 140];
    const step = width / (points.length - 1);
    
    let pathD = `M 0 ${height - points[0]}`;
    points.forEach((p, i) => {
        pathD += ` L ${i * step} ${height - p}`;
    });

    container.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#618033" stop-opacity="0.3" />
                    <stop offset="100%" stop-color="#618033" stop-opacity="0" />
                </linearGradient>
            </defs>
            <path d="${pathD} L ${width} ${height} L 0 ${height} Z" fill="url(#chartGradient)" />
            <path d="${pathD}" stroke="#618033" stroke-width="3" fill="none" stroke-linecap="round" />
        </svg>
    `;
}

async function handleGenerateLeads() {
    showToast('🐝 SalesBee scanning for 990 opportunities...');
    
    // In a real scenario, this would call the Auto-Success Engine or SalesBee template directly
    // For now, we simulate a delay and then refresh
    setTimeout(async () => {
        showToast('✅ 3 New high-match leads discovered!');
        await fetchStats();
        await fetchLeads();
    }, 2000);
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

document.addEventListener('DOMContentLoaded', initDashboard);
