/**
 * Logic Visualizer Frontend
 */

const decisions = [
    { id: '0x123', type: 'ROUTING', score: 0.98, detail: 'Complexity high. Routing to Vinci-V2.' },
    { id: '0x456', type: 'SAFETY', score: 1.0, detail: 'Sanitization complete. Request approved.' },
    { id: '0x789', type: 'PRIORITY', score: 0.61, detail: 'Priority standard. Backgrounding task.' }
];

function init() {
    console.log('🔮 [LogicVisualizer] Initializing live stream...');
    
    const logList = document.getElementById('log-list');
    
    // Simulate real-time updates
    setInterval(() => {
        const dec = decisions[Math.floor(Math.random() * decisions.length)];
        const li = document.createElement('li');
        li.textContent = `[${new Date().toLocaleTimeString()}] ${dec.detail}`;
        logList.prepend(li);
        
        if (logList.children.length > 10) {
            logList.removeChild(logList.lastChild);
        }
    }, 3000);
}

document.addEventListener('DOMContentLoaded', init);
