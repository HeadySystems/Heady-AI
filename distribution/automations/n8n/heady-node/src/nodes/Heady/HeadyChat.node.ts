import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

export class HeadyChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Heady Chat',
		name: 'headyChat',
		icon: 'file:heady.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Send a message to Heady AI and get a response',
		defaults: { name: 'Heady Chat' },
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a chat message and receive a response',
						action: 'Send a chat message',
					},
					{
						name: 'Send with Context',
						value: 'sendWithContext',
						description: 'Send a message with additional context documents',
						action: 'Send a message with context',
					},
				],
				default: 'sendMessage',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				description: 'The message to send to Heady AI',
			},
			{
				displayName: 'Persona',
				name: 'persona',
				type: 'options',
				options: [
					{ name: 'Default', value: 'default' },
					{ name: 'Researcher', value: 'researcher' },
					{ name: 'Grant Writer', value: 'grant-writer' },
					{ name: 'Business Developer', value: 'business-developer' },
					{ name: 'Technical Writer', value: 'technical-writer' },
					{ name: 'Code Reviewer', value: 'code-reviewer' },
				],
				default: 'default',
				description: 'The AI persona to use for the response',
			},
			{
				displayName: 'Context',
				name: 'context',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				displayOptions: {
					show: { operation: ['sendWithContext'] },
				},
				description: 'Additional context documents or knowledge to include',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 1 },
						default: 0.7,
						description: 'Controls randomness in the response',
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 2048,
						description: 'Maximum number of tokens in the response',
					},
					{
						displayName: 'Model',
						name: 'model',
						type: 'string',
						default: '',
						description: 'Override the default AI model (e.g., gemini-2.5-pro, claude-3.5-sonnet)',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('headyApi');

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const message = this.getNodeParameter('message', i) as string;
				const persona = this.getNodeParameter('persona', i) as string;
				const options = this.getNodeParameter('options', i, {}) as Record<string, unknown>;

				const body: Record<string, unknown> = {
					message,
					persona,
					...options,
				};

				if (operation === 'sendWithContext') {
					body.context = this.getNodeParameter('context', i) as string;
				}

				const response = await this.helpers.httpRequest({
					method: 'POST',
					url: `${credentials.apiEndpoint}/api/chat`,
					headers: {
						'Authorization': `Bearer ${credentials.apiKey}`,
						'Content-Type': 'application/json',
					},
					body,
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
