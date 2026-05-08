import { createLogger } from '../../../packages/structured-logger/src/index.js';
import { APIProviderManager } from './api-providers.js';

const logger = createLogger({ service: 'model-router' });

/**
 * Maps models and modalities to appropriate processing logic.
 */
export class ModelRouter {
    constructor() {
        this.modelRegistry = {
            'gemini-2.5-pro': {
                provider: 'google',
                capabilities: ['vision', 'text', 'reasoning'],
                costWeight: 0.8
            },
            'claude-3-opus': {
                provider: 'anthropic',
                capabilities: ['text', 'deep-reasoning', 'coding'],
                costWeight: 1.0
            },
            'gpt-5': {
                provider: 'openai',
                capabilities: ['text', 'agentic', 'vision'],
                costWeight: 1.2
            },
            'deepseek-v3': {
                provider: 'deepseek',
                capabilities: ['text', 'coding'],
                costWeight: 0.3
            }
        };
        this.apiProvider = new APIProviderManager();
    }

    /**
     * Determine the optimal model based on constraints if a specific model isn't requested.
     */
    resolveModel(node) {
        if (node.model && this.modelRegistry[node.model]) {
            return node.model;
        }

        // Fallback or dynamic routing based on modality constraint
        const requiredModality = node.csl_constraints?.modality || 'text';
        
        const capableModels = Object.entries(this.modelRegistry)
            .filter(([_, info]) => info.capabilities.includes(requiredModality))
            .sort((a, b) => a[1].costWeight - b[1].costWeight);

        if (capableModels.length > 0) {
            const selected = capableModels[0][0]; // Pick lowest cost capable model
            logger.info(`Dynamically selected model ${selected} for modality ${requiredModality}`);
            return selected;
        }

        throw new Error(`No model capable of handling modality: ${requiredModality}`);
    }

    /**
     * Executes the node's task using the resolved model.
     * In a full implementation, this routes to actual provider SDKs.
     */
    async executeNode(node, context) {
        const selectedModel = this.resolveModel(node);
        const provider = this.modelRegistry[selectedModel].provider;
        
        logger.info(`Routing task to ${provider} using ${selectedModel}...`);

        // Execute via the API Provider Manager
        const output = await this.apiProvider.call(provider, selectedModel, context);

        return {
            model_used: selectedModel,
            provider,
            output
        };
    }
}
