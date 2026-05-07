/**
 * Fleet Dashboard Frontend Logic
 */

const fleetData = [
    { id: 'K-001', region: 'CA-NOR', status: 'ONLINE', temp: '42°C', revenue: 1240 },
    { id: 'K-042', region: 'NY-NYC', status: 'ONLINE', temp: '38°C', revenue: 5210 },
    { id: 'K-089', region: 'DE-BER', status: 'OFFLINE', temp: '--', revenue: 0 },
    { id: 'K-144', region: 'JP-TYO', status: 'ONLINE', temp: '36°C', revenue: 890 }
];

function init() {
    console.log('📦 [FleetManager] Fetching global kiosk status...');
    
    const body = document.getElementById('fleet-body');
    
    fleetData.forEach(kiosk => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${kiosk.id}</td>
            <td>${kiosk.region}</td>
            <td class="${kiosk.status === 'ONLINE' ? 'status-online' : 'status-offline'}">${kiosk.status}</td>
            <td>${kiosk.temp}</td>
            <td>${kiosk.revenue} HDC</td>
        `;
        body.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', init);
