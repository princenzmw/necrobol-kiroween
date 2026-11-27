import { FolderTree, Terminal, Workflow, X } from 'lucide-react';

interface KiroInspectorModalProps {
  open: boolean;
  onClose: () => void;
}

const KIRO_MANIFEST = [
  {
    group: 'Steering (.kiro/steering/)',
    items: [
      'product.md (inclusion: always): IBM 3270 Resurrection rules, zero-mock runtime guarantee, Y2K parity',
      'tech.md (inclusion: always): React 19 + pure engine shared by browser & Node MCP, zero eval()',
      'structure.md (inclusion: always): Clean split across .kiro/, src/engine/, src/components/, mcp-server/',
    ],
  },
  {
    group: 'Specs (.kiro/specs/)',
    items: [
      'cobol-interpreter/: fixed-point PIC storage, PERFORM loops, time-travel ExecutionStep[] trace',
      'exorcist-analyzer/: 6 static legacy curse detectors + BFS call-graph reachability',
      'modernizer-transpiler/: deterministic TypeScript, Python 3, Vitest parity & line diff verifier',
      'mcp-mainframe-bridge/: stdio JSON-RPC 2.0 MCP server consuming compiled engine bundle',
    ],
  },
  {
    group: 'Agent Hooks (.kiro/hooks/)',
    items: [
      'verify-cobol-engine.json: PostFileSave on src/engine/*.ts -> npm run test -- --run src/engine',
      'verify-mcp-protocol.json: PostFileSave on mcp-server/* -> npm run build:mcp + MCP integration test',
      'lint-and-typecheck.json: PostFileSave on src/**/*.{ts,tsx} -> tsc --noEmit && npm run lint',
    ],
  },
];

export function KiroInspectorModal({ open, onClose }: KiroInspectorModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="hardware-panel max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xs border border-violet-500/50 p-5 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2B313B] pb-3">
          <div className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-violet-300" />
            <h2 className="font-hardware text-sm font-bold text-violet-200">
              Kiro Workflow Inspector (.kiro/ &amp; MCP)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xs p-1 text-zinc-400 hover:bg-[#111418] hover:text-zinc-100"
            aria-label="Close Kiro inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs">
          {KIRO_MANIFEST.map((section) => (
            <div key={section.group} className="rounded-xs border border-[#2B313B] bg-[#111418] p-3">
              <div className="flex items-center gap-1.5 font-mono font-semibold text-violet-300">
                <Workflow className="h-3.5 w-3.5" />
                {section.group}
              </div>
              <ul className="mt-2 space-y-1 text-zinc-300">
                {section.items.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-xs border border-[#2B313B] bg-[#050907] p-3">
            <div className="flex items-center gap-1.5 font-mono font-semibold text-[#34F585]">
              <Terminal className="h-3.5 w-3.5" />
              .kiro/settings/mcp.json -&gt; necrobol-mainframe
            </div>
            <p className="mt-1 text-zinc-400">
              Tools exposed over stdio JSON-RPC 2.0: <code>list_legacy_samples</code>,{' '}
              <code>analyze_cobol</code>, <code>execute_cobol</code>, and <code>transpile_cobol</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
