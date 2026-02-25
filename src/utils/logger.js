const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    purple: "\x1b[35m",
    cyan: "\x1b[36m"
};

const VALID_NODES = [
    'JULES', 'OBSERVER', 'BUILDER', 'ATLAS', 'PYTHIA', 'CONDUCTOR', 
    'BATTLE', 'HCFP', 'PATTERNS', 'ARENA', 'BRANCH'
];

class HeadyLogger {
    constructor() {
        this.env = process.env.NODE_ENV || 'development';
    }

    _formatMessage(node, action, details) {
        const timestamp = new Date().toISOString();
        const nodeStr = `[${node}]`.padEnd(12);
        
        let detailsStr = '';
        if (details) {
            if (typeof details === 'object') {
                detailsStr = JSON.stringify(details);
            } else {
                detailsStr = details;
            }
            detailsStr = ` - ${detailsStr}`;
        }

        return `${c.dim}${timestamp}${c.reset} ${c.bold}${c.cyan}${nodeStr}${c.reset} ${action}${c.dim}${detailsStr}${c.reset}`;
    }

    logNodeActivity(node, action, details = null) {
        if (!VALID_NODES.includes(node)) {
            console.warn(`${c.yellow}⚠️ Unknown AI Node: ${node}${c.reset}`);
        }
        console.log(this._formatMessage(node, action, details));
    }

    logError(node, action, error) {
        const timestamp = new Date().toISOString();
        const nodeStr = `[${node}]`.padEnd(12);
        const errorMsg = error instanceof Error ? error.message : error;
        
        console.error(`${c.dim}${timestamp}${c.reset} ${c.bold}${c.red}${nodeStr}${c.reset} ${c.red}ERROR:${c.reset} ${action} - ${errorMsg}`);
        
        if (error instanceof Error && error.stack && this.env === 'development') {
            console.error(`${c.dim}${error.stack}${c.reset}`);
        }
    }

    logSystem(message) {
        console.log(`${c.bold}${c.purple}[SYSTEM]${c.reset} ${message}`);
    }
}

module.exports = new HeadyLogger();
