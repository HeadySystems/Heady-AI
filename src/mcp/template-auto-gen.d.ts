export function checkForTemplate(toolName: string, args: object): object | null;
export function generateTemplateFromResult(toolName: string, args: object, result: object): object;
export function getTemplateStats(): {
  cachedTemplates: number;
  totalGenerated: number;
  activeBees: any;
  history: any[];
};
export function withTemplateAutoGen(originalCallTool: Function, toolName: string, args: object): object;
export const generatedTemplates: Map<any, any>;
export const templateHistory: any[];