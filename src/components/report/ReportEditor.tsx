import { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
    $getRoot,
    $createParagraphNode,
    $createTextNode,
} from 'lexical';
import type { EditorState, LexicalEditor } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { $generateHtmlFromNodes } from '@lexical/html';

import { ToolbarPlugin } from './plugins/ToolbarPlugin';
import { ScrollArea } from '@/components/ui/scroll-area';

// Lexical theme configuration
const editorTheme = {
    paragraph: 'mb-2 leading-relaxed',
    heading: {
        h1: 'text-3xl font-bold mb-4',
        h2: 'text-2xl font-bold mb-3',
        h3: 'text-xl font-bold mb-2',
        h4: 'text-lg font-bold mb-2',
        h5: 'text-base font-bold mb-1',
    },
    text: {
        bold: 'font-bold',
        italic: 'italic',
        underline: 'underline',
        strikethrough: 'line-through',
        subscript: 'text-xs align-sub',
        superscript: 'text-xs align-super',
    },
    list: {
        ul: 'list-disc ml-6 mb-2',
        ol: 'list-decimal ml-6 mb-2',
        listitem: 'mb-1',
    },
    quote: 'border-l-4 border-primary pl-4 italic text-muted-foreground mb-2',
    code: 'bg-muted px-1 py-0.5 rounded font-mono text-sm',
    codeHighlight: {
        atrule: 'text-purple-500',
        attr: 'text-blue-500',
        boolean: 'text-orange-500',
        builtin: 'text-cyan-500',
        cdata: 'text-gray-500',
        char: 'text-green-500',
        class: 'text-yellow-500',
        'class-name': 'text-yellow-500',
        comment: 'text-gray-500 italic',
        constant: 'text-orange-500',
        deleted: 'text-red-500',
        doctype: 'text-gray-500',
        entity: 'text-orange-500',
        function: 'text-blue-500',
        important: 'text-red-500 font-bold',
        inserted: 'text-green-500',
        keyword: 'text-purple-500',
        namespace: 'text-cyan-500',
        number: 'text-orange-500',
        operator: 'text-gray-500',
        prolog: 'text-gray-500',
        property: 'text-blue-500',
        punctuation: 'text-gray-500',
        regex: 'text-orange-500',
        selector: 'text-green-500',
        string: 'text-green-500',
        symbol: 'text-orange-500',
        tag: 'text-red-500',
        url: 'text-blue-500',
        variable: 'text-orange-500',
    },
    link: 'text-primary underline cursor-pointer',
    table: 'border-collapse w-full mb-4',
    tableCell: 'border border-border p-2',
    tableCellHeader: 'border border-border p-2 bg-muted font-bold',
};

// Initial editor configuration
function getEditorConfig(namespace: string) {
    return {
        namespace,
        theme: editorTheme,
        nodes: [
            HeadingNode,
            QuoteNode,
            ListNode,
            ListItemNode,
            LinkNode,
            CodeNode,
            CodeHighlightNode,
            TableNode,
            TableCellNode,
            TableRowNode,
        ],
        onError: (error: Error) => {
            console.error('Lexical error:', error);
        },
    };
}

// Plugin to set initial content
interface SetContentPluginProps {
    content: string;
}

function SetContentPlugin({ content }: SetContentPluginProps) {
    const [editor] = useLexicalComposerContext();
    const hasSetInitialContent = useRef(false);

    useEffect(() => {
        if (content && !hasSetInitialContent.current) {
            editor.update(() => {
                const root = $getRoot();
                root.clear();

                // Split content by newlines and create paragraphs
                const lines = content.split('\n');
                lines.forEach((line) => {
                    const paragraph = $createParagraphNode();
                    if (line.trim()) {
                        paragraph.append($createTextNode(line));
                    }
                    root.append(paragraph);
                });
            });
            hasSetInitialContent.current = true;
        }
    }, [content, editor]);

    // Reset flag when content changes to allow re-setting
    useEffect(() => {
        hasSetInitialContent.current = false;
    }, [content]);

    return null;
}

// Export ref methods
export interface ReportEditorRef {
    getContent: () => string;
    getHtml: () => string;
    getEditorState: () => Record<string, any>;
    setContent: (content: string) => void;
    setEditorState: (state: Record<string, any>) => void;
    focus: () => void;
}

interface ReportEditorProps {
    initialContent?: string;
    onChange?: (content: string) => void;
    placeholder?: string;
}

// Inner editor component that has access to the Lexical context
interface EditorCoreProps {
    initialContent?: string;
    onChange?: (content: string) => void;
    placeholder?: string;
}

const EditorCore = forwardRef<ReportEditorRef, EditorCoreProps>(
    ({ initialContent = '', onChange, placeholder = 'Start typing your report...' }, ref) => {
        const [editor] = useLexicalComposerContext();

        const handleChange = useCallback(
            (editorState: EditorState, _editor: LexicalEditor) => {
                editorState.read(() => {
                    const root = $getRoot();
                    const text = root.getTextContent();
                    onChange?.(text);
                });
            },
            [onChange]
        );

        // Expose methods via ref
        useImperativeHandle(ref, () => ({
            getContent: () => {
                let content = '';
                editor.getEditorState().read(() => {
                    content = $getRoot().getTextContent();
                });
                return content;
            },
            getHtml: () => {
                let html = '';
                editor.getEditorState().read(() => {
                    html = $generateHtmlFromNodes(editor);
                });
                return html;
            },
            getEditorState: () => {
                return editor.getEditorState().toJSON();
            },
            setContent: (content: string) => {
                editor.update(() => {
                    const root = $getRoot();
                    root.clear();
                    const lines = content.split('\n');
                    lines.forEach((line) => {
                        const paragraph = $createParagraphNode();
                        if (line.trim()) {
                            paragraph.append($createTextNode(line));
                        }
                        root.append(paragraph);
                    });
                });
            },
            setEditorState: (state: Record<string, any>) => {
                const editorState = editor.parseEditorState(JSON.stringify(state));
                editor.setEditorState(editorState);
            },
            focus: () => {
                editor.focus();
            },
        }));

        return (
            <>
                <ToolbarPlugin />
                <SetContentPlugin content={initialContent} />
                <OnChangePlugin onChange={handleChange} />
                <HistoryPlugin />
                <ListPlugin />
                <TabIndentationPlugin />

                <ScrollArea className="flex-1">
                    <div className="p-4 min-h-full">
                        {/* A4-like paper container - optimized for space */}
                        <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-sm min-h-200 p-8 text-black">
                            <div className="relative">
                                <RichTextPlugin
                                    contentEditable={
                                        <ContentEditable
                                            className="outline-none min-h-175 leading-relaxed prose prose-sm max-w-none"
                                            style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px' }}
                                        />
                                    }
                                    placeholder={
                                        <div className="text-slate-400 absolute top-0 left-0 pointer-events-none select-none" style={{ fontFamily: 'Times New Roman, serif', fontSize: '13px' }}>
                                            {placeholder}
                                        </div>
                                    }
                                    ErrorBoundary={LexicalErrorBoundary}
                                />
                            </div>
                        </div>
                    </div>
                </ScrollArea>
            </>
        );
    }
);

EditorCore.displayName = 'EditorCore';

// Main ReportEditor component
export const ReportEditor = forwardRef<ReportEditorRef, ReportEditorProps>(
    ({ initialContent = '', onChange, placeholder }, ref) => {
        const editorConfig = getEditorConfig('ReportEditor');

        return (
            <LexicalComposer initialConfig={editorConfig}>
                <div className="flex flex-col h-full bg-gray-800">
                    <EditorCore
                        ref={ref}
                        initialContent={initialContent}
                        onChange={onChange}
                        placeholder={placeholder}
                    />
                </div>
            </LexicalComposer>
        );
    }
);

ReportEditor.displayName = 'ReportEditor';
