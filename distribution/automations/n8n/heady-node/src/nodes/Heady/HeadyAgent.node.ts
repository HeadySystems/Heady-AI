import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class HeadyAgent implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Heady Agent',
		name: 'headyAgent',
		icon: 'file:heady.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["agentType"]}} Agent',
		description: 'Trigger Heady AI agents for structured task execution',
		defaults: { name: 'Heady Agent' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'headyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Agent Type',
				name: 'agentType',
				type: 'options',
				options: [
					{ name: 'Researcher', value: 'researcher', description: 'Deep research and analysis' },
					{ name: 'Grant Writer', value: 'grant-writer', description: 'Grant proposal drafting' },
					{ name: 'Business Developer', value: 'business-developer', description: 'BD outreach and strategy' },
					{ name: 'Code Reviewer', value: 'code-reviewer', description: 'Code analysis and review' },
					{ name: 'Data Analyst', value: 'data-analyst', description: 'Data processing and insights' },
					{ name: 'Content Creator', value: 'content-creator', description: 'Blog posts, docs, marketing' },
					{ name: 'Custom', value: 'custom', description: 'Custom agent by ID' },
				],
				default: 'researcher',
				description: 'Type of Heady agent to invoke',
			},
			{
				displayName: 'Custom Agent ID',
				name: 'customAgentId',
				type: 'string',
				default: '',
				displayOptions: { show: { agentType: ['custom'] } },
				description: 'ID of the custom agent to invoke',
			},
			{
				displayName: 'Task',
				name: 'task',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				required: true,
				description: 'Structured task definition for the agent',
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: true,
				description: 'Whether to wait for the agent to complete (may take minutes)',
			},
			{
				displayName: 'Timeout (seconds)',
				name: 'timeout',
				type: 'number',
				default: 300,
				displayOptions: { show: { waitForCompletion: [true] } },
				description: 'Maximum time to wait for agent completion',
			},
			{
				displayName: 'Additional Context',
				name: 'additionalContext',
				type: 'json',
				default: '{}',
				description: 'Additional JSON context to pass to the agent',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('headyApi');

		for (let i = 0; i < items.length; i++) {
			try {
				const agentType = this.getNodeParameter('agentType', i) as string;
				const task = this.getNodeParameter('task', i) as string;
				const waitForCompletion = this.getNodeParameter('waitForCompletion', i) as boolean;
				const timeout = this.getNodeParameter('timeout', i, 300) as number;
				const additionalContext = this.getNodeParameter('additionalContext', i, '{}') as string;

				const agentId = agentType === 'custom'
					? this.getNodeParameter('customAgentId', i) as string
					: agentType;

				let parsedContext = {};
				try { parsedContext = JSON.parse(additionalContext); } catch { /* ignore */ }

				// Dispatch task to agent
				const dispatch = await this.helpers.httpRequest({
					method: 'POST',
					url: `${credentials.apiEndpoint}/api/agents/${agentId}/tasks`,
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: { task, context: parsedContext, source: 'n8n' },
					json: true,
				});

				if (!waitForCompletion) {
					returnData.push({ json: { ...dispatch, status: 'dispatched' } });
					continue;
				}

				// Poll for completion
				const pollInterval = 5000; // 5 seconds
				const maxPolls = Math.ceil((timeout * 1000) / pollInterval);
				let result = dispatch;

				for (let p = 0; p < maxPolls; p++) {
					await new Promise(resolve => setTimeout(resolve, pollInterval));

					result = await this.helpers.httpRequest({
						method: 'GET',
						url: `${credentials.apiEndpoint}/api/agents/${agentId}/tasks/${dispatch.jobId}`,
						headers: { 'Authorization': `Bearer ${credentials.apiKey}` },
						json: true,
					});

					if (result.status === 'completed' || result.status === 'failed') break;
				}

				returnData.push({ json: result });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } });
				} else {
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				}
			}
		}

		return [returnData];
	}
}
