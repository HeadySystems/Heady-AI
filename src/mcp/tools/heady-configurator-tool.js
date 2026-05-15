import { SystemConfigurator } from '../../core/orchestrator/system-configurator.js';

export const headyConfiguratorDef = {
    name: 'heady_system_reconfigure',
    description: 'Autonomous auto-success engine interface. Enables Heady to self-diagnose and modify its own environment configuration, resolve dependency conflicts, or patch configuration files dynamically without manual intervention.',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['auto_resolve_env', 'provision_dependencies', 'patch_config'],
                description: 'The autonomous configuration action to perform.'
            },
            dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of dependency names to install if action is provision_dependencies.'
            },
            config_path: {
                type: 'string',
                description: 'Relative path to the configuration file (if action is patch_config).'
            },
            patch_data: {
                type: 'object',
                description: 'JSON object representing the data to merge/patch (if action is patch_config).'
            }
        },
        required: ['action']
    }
};

export async function handleHeadyConfigurator(args) {
    const configurator = new SystemConfigurator();
    
    try {
        switch (args.action) {
            case 'auto_resolve_env':
                const envResult = await configurator.autoResolveEnvironment();
                return {
                    content: [{ type: 'text', text: JSON.stringify(envResult, null, 2) }]
                };
            case 'provision_dependencies':
                if (!args.dependencies || args.dependencies.length === 0) {
                    throw new Error('Dependencies array is required for provision_dependencies action.');
                }
                const provResult = await configurator.autoProvisionDependencies(args.dependencies);
                return {
                    content: [{ type: 'text', text: JSON.stringify(provResult, null, 2) }]
                };
            case 'patch_config':
                if (!args.config_path || !args.patch_data) {
                    throw new Error('config_path and patch_data are required for patch_config action.');
                }
                const patchResult = await configurator.patchConfiguration(args.config_path, args.patch_data);
                return {
                    content: [{ type: 'text', text: JSON.stringify(patchResult, null, 2) }]
                };
            default:
                throw new Error(`Unknown action: ${args.action}`);
        }
    } catch (error) {
        return {
            content: [{ type: 'text', text: `Configuration Action Failed: ${error.message}` }],
            isError: true
        };
    }
}
