/**
 * generate-dependency-graph.js — Scans all .js modules and produces
 * a dependency graph in Mermaid + JSON format.
 * Author: Eric Haywood
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, extname } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUTPUT_MERMAID = join(ROOT, 'docs', 'DEPENDENCY_GRAPH.md');
const OUTPUT_JSON = join(ROOT, 'docs', 'dependency-graph.json');

function walk(dir, base = ROOT) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            if (['node_modules', '.git', '.husky', 'skills'].includes(entry)) continue;
            files.push(...walk(full, base));
        } else if (extname(entry) === '.js' && !entry.startsWith('gen-')) {
            files.push(relative(base, full));
        }
    }
    return files;
}

function extractImports(filePath) {
    try {
        const content = readFileSync(join(ROOT, filePath), 'utf8');
        const imports = [];
        const importRegex = /from\s+['"](\.\.\\/[^ '"]+|\\.\\/[^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    } catch {
        return [];
    }
}

function buildGraph() {
    const files = walk(ROOT);
    const graph = {};
    const edges = [];

    for (const file of files) {
        const imports = extractImports(file);
        const moduleName = file.replace(/\.js$/, '');
        graph[moduleName] = { file, imports };

        for (const imp of imports) {
            edges.push({ from: moduleName, to: imp.replace(/\.js$/, '') });
        }
    }

    return { files, graph, edges };
}

function generateMermaid(edges, files) {
    const lines = ['# Dependency Graph\n', '```mermaid', 'graph TD'];

    // Group files by directory
    const dirs = new Map();
    for (const file of files) {
        const dir = file.split('/')[0];
        if (!dirs.has(dir)) dirs.set(dir, []);
        dirs.get(dir).push(file);
    }

    for (const [dir, dirFiles] of dirs) {
        lines.push(`  subgraph ${dir}`);
        for (const f of dirFiles) {
            const id = f.replace(/[\/.]/g, '_');
            const label = f.split('/').pop().replace('.js', '');
            lines.push(`    ${id}[${label}]`);
        }
        lines.push('  end');
    }

    for (const edge of edges) {
        const fromId = edge.from.replace(/[\/.]/g, '_');
        const toId = edge.to.replace(/[\/.]/g, '_');
        lines.push(`  ${fromId} --> ${toId}`);
    }

    lines.push('```');
    return lines.join('\n');
}

// Execute
const { files, graph, edges } = buildGraph();

const mermaidContent = generateMermaid(edges, files);
writeFileSync(OUTPUT_MERMAID, mermaidContent, 'utf8');
console.log(`  ✓ ${OUTPUT_MERMAID} (${files.length} modules, ${edges.length} edges)`);

writeFileSync(OUTPUT_JSON, JSON.stringify({ totalModules: files.length, totalEdges: edges.length, graph }, null, 2), 'utf8');
console.log(`  ✓ ${OUTPUT_JSON}`);
