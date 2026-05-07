import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HeadyApi implements ICredentialType {
	name = 'headyApi';
	displayName = 'Heady API';
	documentationUrl = 'https://docs.headyme.com/api';

	properties: INodeProperties[] = [
		{
			displayName: 'API Endpoint',
			name: 'apiEndpoint',
			type: 'string',
			default: 'https://headyapi.com',
			placeholder: 'https://headyapi.com',
			description: 'Your Heady API base URL',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Your Heady API key from the admin panel',
			required: true,
		},
	];
}
