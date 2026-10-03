'use client';

import React, { useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { FileCode, FileText, Lock, Sparkles, Check, Copy } from 'lucide-react';
import { usePlayground } from '@/context/PlaygroundContext';

export const EditorPane: React.FC = () => {
  const { files, activeFileId, setActiveFileId, updateFileContent } = usePlayground();
  const editorRef = useRef<any>(null);
  const [copied, setCopied] = React.useState(false);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  const handleEditorDidMount: OnMount = (editor, monaco: Monaco) => {
    editorRef.current = editor;

    // Define "Dark Silicon" custom Monaco theme
    monaco.editor.defineTheme('dark-silicon', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '38bdf8', fontStyle: 'bold' },
        { token: 'type', foreground: '10b981' },
        { token: 'number', foreground: 'facc15' },
        { token: 'string', foreground: 'fbbf24' },
        { token: 'identifier', foreground: 'e2e8f0' },
        { token: 'delimiter', foreground: '94a3b8' },
      ],
      colors: {
        'editor.background': '#0b0e14',
        'editor.foreground': '#e2e8f0',
        'editorCursor.foreground': '#facc15',
        'editor.lineHighlightBackground': '#121820',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#38bdf8',
        'editor.selectionBackground': '#1e293b',
        'editor.inactiveSelectionBackground': '#161e29',
      },
    });

    monaco.editor.setTheme('dark-silicon');
  };

  const handleCopy = () => {
    if (activeFile) {
      navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0b0e14] overflow-hidden min-w-0">
      {/* Tab Bar Header */}
      <div className="h-8 bg-[#121820] border-b border-[#1f2937] flex items-center justify-between px-2 select-none shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {files.map((file) => {
            const isActive = file.id === activeFileId;
            return (
              <button
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={`h-7 px-3 flex items-center gap-2 text-xs font-mono rounded-t transition-all ${
                  isActive
                    ? 'bg-[#0b0e14] text-cyan-300 font-semibold border-t-2 border-t-cyan-400 border-x border-[#1f2937]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#1a222d]'
                }`}
              >
                {file.type === 'log' ? (
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                )}
                <span>{file.name}</span>
                {file.isReadOnly && (
                  <span title="Read-only generated report">
                    <Lock className="w-3 h-3 text-slate-500 ml-1" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Utilities */}
        <div className="flex items-center gap-2 pr-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[#1a222d] hover:bg-[#232d3b] text-slate-400 hover:text-slate-200 border border-[#232d3b] transition-colors"
            title="Copy editor contents"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Editor Surface */}
      <div className="flex-1 w-full relative">
        <Editor
          height="100%"
          language={activeFile.id.endsWith('.v') ? 'verilog' : 'shell'}
          theme="dark-silicon"
          value={activeFile.content}
          onChange={(val) => updateFileContent(activeFile.id, val || '')}
          onMount={handleEditorDidMount}
          options={{
            readOnly: activeFile.isReadOnly || false,
            minimap: { enabled: false },
            fontSize: 13,
            lineHeight: 20,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontLigatures: true,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            bracketPairColorization: { enabled: true },
            wordWrap: 'on',
            lineNumbersMinChars: 3,
            renderLineHighlight: 'all',
          }}
        />
      </div>
    </div>
  );
};
