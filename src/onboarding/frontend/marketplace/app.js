/**
 * Marketplace Discovery Frontend
 */

const mockModules = [
    { id: 'mod-legal-pro', name: 'LegalBee Pro', author: 'SovereignDAO', price: 233, description: 'Advanced jurisdictional compliance for EU/UK.' },
    { id: 'mod-vision-kit', name: 'VisionBee V2', author: 'OpticSwarm', price: 144, description: 'High-fidelity image analysis for kiosks.' },
    { id: 'mod-security-hardener', name: 'ShieldBee', author: 'AntifragileInc', price: 377, description: 'Active DDoS and intrusion suppression.' }
];

function init() {
    const grid = document.getElementById('module-grid');
    const balanceEl = document.getElementById('user-balance');
    
    // Initial balance mock
    balanceEl.textContent = 'Balance: 1618 HDC';

    mockModules.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'module-card';
        card.innerHTML = `
            <h3>${mod.name}</h3>
            <p>${mod.description}</p>
            <div class="author">by ${mod.author}</div>
            <div class="price">${mod.price} HDC</div>
            <button class="btn-purchase" onclick="purchase('${mod.id}')">License Module</button>
        `;
        grid.appendChild(card);
    });
}

function purchase(moduleId) {
    console.log(`🛒 Purchasing ${moduleId}...`);
    alert(`Success! Module ${moduleId} has been licensed to your sovereign node.`);
}

document.addEventListener('DOMContentLoaded', init);
