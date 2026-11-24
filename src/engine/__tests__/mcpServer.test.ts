import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COBOL_SAMPLES } from '../samples';

function queryMcpServer(requests: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolvePromise, reject) => {
    const serverPath = resolve(process.cwd(), 'mcp-server/server.mjs');
    const child = spawn(process.execPath, [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const responses: Array<Record<string, unknown>> = [];
    let buffer = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        responses.push(JSON.parse(line) as Record<string, unknown>);
        if (responses.length >= requests.length) {
          child.kill();
          resolvePromise(responses);
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (responses.length < requests.length) {
        reject(new Error(`MCP server exited early (code=${code}): ${stderr}`));
      }
    });

    for (const req of requests) {
      child.stdin.write(`${JSON.stringify(req)}\n`);
    }
  });
}

describe('NecroBOL stdio MCP server bridge', () => {
  it('handles initialize, tools/list, and tools/call end-to-end', async () => {
    const bundlePath = resolve(process.cwd(), 'mcp-server/engine-bundle.mjs');
    expect(existsSync(bundlePath)).toBe(true);

    const replies = await queryMcpServer([
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'analyze_cobol', arguments: { source: COBOL_SAMPLES[0].source } },
      },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'transpile_cobol',
          arguments: { source: COBOL_SAMPLES[3].source, target: 'python' },
        },
      },
    ]);

    expect((replies[0].result as { serverInfo: { name: string } }).serverInfo.name).toBe(
      'necrobol-mainframe',
    );
    const tools = (replies[1].result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    expect(tools).toEqual([
      'list_legacy_samples',
      'analyze_cobol',
      'execute_cobol',
      'transpile_cobol',
    ]);

    const analysisText = (
      replies[2].result as { content: Array<{ text: string }> }
    ).content[0].text;
    const analysis = JSON.parse(analysisText) as { ghostParagraphs: string[] };
    expect(analysis.ghostParagraphs).toEqual(['GHOST-AUDIT-LOG']);

    const transpileText = (
      replies[3].result as { content: Array<{ text: string }> }
    ).content[0].text;
    const transpiled = JSON.parse(transpileText) as {
      target: string;
      parity: { passed: boolean };
    };
    expect(transpiled.target).toBe('python');
    expect(transpiled.parity.passed).toBe(true);
  });
});
