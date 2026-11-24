import readline from 'node:readline';
import {
  analyzeCobolSource,
  COBOL_SAMPLES,
  executeCobolSource,
  transpileCobolSource,
} from './engine-bundle.mjs';

const SERVER_INFO = {
  name: 'necrobol-mainframe',
  version: '1.0.0',
};

const TOOLS = [
  {
    name: 'list_legacy_samples',
    description: 'List built-in archival COBOL-85 programs available in NecroBOL.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'analyze_cobol',
    description: 'Run the NecroBOL Exorcist static analyzer on COBOL-85 source to find Y2K bugs, GO TO jumps, ghost paragraphs, overflow risks, and haunting score.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'COBOL-85 source program text' },
      },
      required: ['source'],
      additionalProperties: false,
    },
  },
  {
    name: 'execute_cobol',
    description: 'Execute COBOL-85 source in the deterministic NecroBOL interpreter and return stdout, final WORKING-STORAGE variables, warnings, and step count.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'COBOL-85 source program text' },
      },
      required: ['source'],
      additionalProperties: false,
    },
  },
  {
    name: 'transpile_cobol',
    description: 'Transpile COBOL-85 source to TypeScript or Python with byte-for-byte parity verification against the COBOL interpreter.',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'COBOL-85 source program text' },
        target: {
          type: 'string',
          enum: ['typescript', 'python'],
          description: 'Target language to return alongside parity proof (defaults to typescript).',
        },
      },
      required: ['source'],
      additionalProperties: false,
    },
  },
];

function sendMessage(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function sendResult(id, result) {
  sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message) {
  sendMessage({ jsonrpc: '2.0', id, error: { code, message } });
}

function handleToolCall(name, args) {
  switch (name) {
    case 'list_legacy_samples':
      return COBOL_SAMPLES.map((s) => ({
        id: s.id,
        title: s.title,
        era: s.era,
        summary: s.summary,
      }));
    case 'analyze_cobol':
      if (typeof args?.source !== 'string') {
        throw new Error('Expected string argument "source".');
      }
      return analyzeCobolSource(args.source);
    case 'execute_cobol': {
      if (typeof args?.source !== 'string') {
        throw new Error('Expected string argument "source".');
      }
      const res = executeCobolSource(args.source);
      return {
        programId: res.programId,
        haltedReason: res.haltedReason,
        output: res.output,
        warnings: res.warnings,
        stepCount: res.steps.length,
        finalVariables: res.finalVariables,
        parseErrors: res.parseErrors,
      };
    }
    case 'transpile_cobol': {
      if (typeof args?.source !== 'string') {
        throw new Error('Expected string argument "source".');
      }
      const tr = transpileCobolSource(args.source);
      const target = args?.target === 'python' ? 'python' : 'typescript';
      return {
        programId: tr.programId,
        target,
        code: target === 'python' ? tr.pythonCode : tr.typescriptCode,
        parity: tr.parity,
      };
    }
    default:
      throw new Error(`Unknown tool "${name}".`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (rawLine) => {
  const line = rawLine.trim();
  if (!line) return;

  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    sendError(null, -32700, 'Parse error');
    return;
  }

  const { id, method, params } = msg;
  if (id === undefined || id === null) {
    return;
  }

  try {
    if (method === 'initialize') {
      sendResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    }

    if (method === 'ping') {
      sendResult(id, {});
      return;
    }

    if (method === 'tools/list') {
      sendResult(id, { tools: TOOLS });
      return;
    }

    if (method === 'tools/call') {
      const data = handleToolCall(params?.name, params?.arguments);
      sendResult(id, {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        isError: false,
      });
      return;
    }

    sendError(id, -32601, `Method not found: ${String(method)}`);
  } catch (err) {
    if (method === 'tools/call') {
      sendResult(id, {
        content: [
          {
            type: 'text',
            text: err instanceof Error ? err.message : 'Tool execution error',
          },
        ],
        isError: true,
      });
      return;
    }
    sendError(id, -32603, err instanceof Error ? err.message : 'Internal error');
  }
});
