export const domain: "templates";
export const description: "Sacred geometry site template engine \u2014 delivers branded pages for every Heady domain";
export const priority: 0.9;
export function getWork(ctx?: {}): (() => Promise<{
  bee: string;
  action: string;
  site: string;
  rendered: boolean;
  sacredGeometry: any;
}>)[];
export function renderSite(hostname: string): string;
export function resolveDomain(hostname: any): any;
export function generateNav(activeDomain: any): string;
export function generateAuthGate(siteName: any, accent: any, domain: any): string;
export function getAllSiteTemplates(): {};
export const AUTH_PROVIDERS: {
  id: string;
  name: string;
  icon: string;
}[];
export const HEADY_SITES: string[][];