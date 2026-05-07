import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class HeadyWorkflow implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Heady Workflow',
		name: 'headyWorkflow',
		icon: 'file:heady.svg',
		group: ['transform'],
		version: 1,
		subtitle: 'Trigger {{$parameter["workflowType"]}} workflow',
		description: 'Trigger durable Upstash Workflows in the Heady ecosystem',
		defaults: { name: 'Heady Workflow' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'headyApi', required: true }],
		properties: [
			{
				displayName: 'Workflow Type',
				name: 'workflowType',
				type: 'options',
				options: [
					{ name: 'HCFP Pipeline', value: 'pipeline', description: '22-stage durable pipeline' },
					{ name: 'Agent Orchestration', value: 'agent', description: 'Multi-agent task dispatch' },
					{ name: 'Health Sweep', value: 'health', description: 'Service health check sweep' },
					{ name: 'Linear Sync', value: 'linear-sync', description: 'Sync Linear issues to cache' },
					{ name: 'Custom', value: 'custom', description: 'Trigger via manual /trigger endpoint' },
				],
				default: 'pipeline',
			},
			{
				displayName: 'Payload',
				name: 'payload',
				type: 'json',
				default: '{}',
				required: true,
				description: 'JSON payload to pass to the workflow',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('headyApi');

		for (let i = 0; i < items.length; i++) {
			try {
				const workflowType = this.getNodeParameter('workflowType', i) as string;
				const payloadStr = this.getNodeParameter('payload', i) as string;
				let payload = {};
				try { payload = JSON.parse(payloadStr); } catch { /* ignore */ }

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: `${credentials.apiEndpoint}/api/workflow/trigger`,
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: { workflow: workflowType, payload },
					json: true,
				});

				returnData.push({ json: response });
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
