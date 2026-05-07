import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';

export class HeadyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Heady Trigger',
		name: 'headyTrigger',
		icon: 'file:heady.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["eventType"]}} events',
		description: 'Triggers workflow on Heady ecosystem events',
		defaults: { name: 'Heady Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'headyApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'heady-webhook',
			},
		],
		properties: [
			{
				displayName: 'Event Type',
				name: 'eventType',
				type: 'options',
				options: [
					{ name: 'Chat Message', value: 'chat.message', description: 'New chat message received' },
					{ name: 'Agent Completed', value: 'agent.completed', description: 'Agent task finished' },
					{ name: 'Agent Failed', value: 'agent.failed', description: 'Agent task failed' },
					{ name: 'Pipeline Stage', value: 'pipeline.stage', description: 'Pipeline stage completed' },
					{ name: 'Pipeline Complete', value: 'pipeline.complete', description: 'Full pipeline finished' },
					{ name: 'Health Alert', value: 'health.alert', description: 'Service health check failure' },
					{ name: 'Deployment', value: 'deploy.complete', description: 'Deployment completed' },
					{ name: 'All Events', value: '*', description: 'Receive all Heady events' },
				],
				default: 'agent.completed',
				description: 'Which Heady event to listen for',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				// Check if webhook is already registered with Heady
				const credentials = await this.getCredentials('headyApi');
				const webhookUrl = this.getNodeWebhookUrl('default');

				try {
					// We can't easily check, so always re-register
					return false;
				} catch {
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('headyApi');
				const webhookUrl = this.getNodeWebhookUrl('default');
				const eventType = this.getNodeParameter('eventType') as string;

				try {
					await this.helpers.httpRequest({
						method: 'POST',
						url: `${credentials.apiEndpoint}/api/n8n/subscribe`,
						headers: {
							'Authorization': `Bearer ${credentials.apiKey}`,
							'Content-Type': 'application/json',
						},
						body: { eventType, webhookUrl },
						json: true,
					});
					return true;
				} catch {
					return false;
				}
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const credentials = await this.getCredentials('headyApi');
				const webhookUrl = this.getNodeWebhookUrl('default');
				const eventType = this.getNodeParameter('eventType') as string;

				try {
					await this.helpers.httpRequest({
						method: 'POST',
						url: `${credentials.apiEndpoint}/api/n8n/unsubscribe`,
						headers: {
							'Authorization': `Bearer ${credentials.apiKey}`,
							'Content-Type': 'application/json',
						},
						body: { eventType, webhookUrl },
						json: true,
					});
					return true;
				} catch {
					return false;
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		return {
			workflowData: [this.helpers.returnJsonArray(body as unknown as Record<string, unknown>)],
		};
	}
}
