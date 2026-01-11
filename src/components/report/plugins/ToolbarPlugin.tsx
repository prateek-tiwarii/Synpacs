import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useEffect, useState } from 'react';
import {
    $getSelection,
    $isRangeSelection,
    FORMAT_TEXT_COMMAND,
    FORMAT_ELEMENT_COMMAND,
    UNDO_COMMAND,
    REDO_COMMAND,
    CAN_UNDO_COMMAND,
    CAN_REDO_COMMAND,
} from 'lexical';
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    Undo2,
    Redo2,
    Subscript,
    Superscript,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { $patchStyleText } from '@lexical/selection';

interface ToolbarButtonProps {
    icon: React.ReactNode;
    active?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
}

const ToolbarButton = ({ icon, active = false, onClick, disabled = false, title }: ToolbarButtonProps) => (
    <Button
        variant="ghost"
        size="sm"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`h-7 w-7 p-0 text-gray-300 hover:text-white ${active ? 'bg-blue-500/30 text-blue-300' : 'hover:bg-gray-700'} ${disabled ? 'opacity-40' : ''}`}
    >
        {icon}
    </Button>
);

const FONT_SIZES = [
    '10px', '11px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'
];

const FONT_FAMILIES = [
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Calibri',
];

export function ToolbarPlugin() {
    const [editor] = useLexicalComposerContext();
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [isSubscript, setIsSubscript] = useState(false);
    const [isSuperscript, setIsSuperscript] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [fontSize, setFontSize] = useState('14px');
    const [fontFamily, setFontFamily] = useState('Arial');

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            setIsBold(selection.hasFormat('bold'));
            setIsItalic(selection.hasFormat('italic'));
            setIsUnderline(selection.hasFormat('underline'));
            setIsStrikethrough(selection.hasFormat('strikethrough'));
            setIsSubscript(selection.hasFormat('subscript'));
            setIsSuperscript(selection.hasFormat('superscript'));
        }
    }, []);

    useEffect(() => {
        return editor.registerUpdateListener(({ editorState }) => {
            editorState.read(() => {
                updateToolbar();
            });
        });
    }, [editor, updateToolbar]);

    useEffect(() => {
        return editor.registerCommand(
            CAN_UNDO_COMMAND,
            (payload) => {
                setCanUndo(payload);
                return false;
            },
            1
        );
    }, [editor]);

    useEffect(() => {
        return editor.registerCommand(
            CAN_REDO_COMMAND,
            (payload) => {
                setCanRedo(payload);
                return false;
            },
            1
        );
    }, [editor]);

    const applyFontSize = useCallback(
        (size: string) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { 'font-size': size });
                }
            });
            setFontSize(size);
        },
        [editor]
    );

    const applyFontFamily = useCallback(
        (family: string) => {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    $patchStyleText(selection, { 'font-family': family });
                }
            });
            setFontFamily(family);
        },
        [editor]
    );

    return (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-gray-900 border-gray-700 flex-wrap">
            {/* Undo/Redo */}
            <div className="flex items-center gap-0.5">
                <ToolbarButton
                    icon={<Undo2 size={14} />}
                    disabled={!canUndo}
                    onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
                    title="Undo (Ctrl+Z)"
                />
                <ToolbarButton
                    icon={<Redo2 size={14} />}
                    disabled={!canRedo}
                    onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
                    title="Redo (Ctrl+Y)"
                />
            </div>

            <Separator orientation="vertical" className="h-5 mx-1 bg-gray-600" />

            {/* Font Family */}
            <Select value={fontFamily} onValueChange={applyFontFamily}>
                <SelectTrigger className="w-[100px] h-7 text-xs border-gray-600 bg-gray-700 text-gray-200">
                    <SelectValue placeholder="Font" />
                </SelectTrigger>
                <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                            {font}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Font Size */}
            <Select value={fontSize} onValueChange={applyFontSize}>
                <SelectTrigger className="w-[60px] h-7 text-xs border-gray-600 bg-gray-700 text-gray-200">
                    <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                    {FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                            {size.replace('px', '')}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Separator orientation="vertical" className="h-5 mx-1 bg-gray-600" />

            {/* Text Formatting */}
            <div className="flex items-center gap-0.5">
                <ToolbarButton
                    icon={<Bold size={14} />}
                    active={isBold}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
                    title="Bold (Ctrl+B)"
                />
                <ToolbarButton
                    icon={<Italic size={14} />}
                    active={isItalic}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
                    title="Italic (Ctrl+I)"
                />
                <ToolbarButton
                    icon={<Underline size={14} />}
                    active={isUnderline}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
                    title="Underline (Ctrl+U)"
                />
                <ToolbarButton
                    icon={<Strikethrough size={14} />}
                    active={isStrikethrough}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
                    title="Strikethrough"
                />
            </div>

            <Separator orientation="vertical" className="h-5 mx-1 bg-gray-600" />

            {/* Subscript/Superscript */}
            <div className="flex items-center gap-0.5">
                <ToolbarButton
                    icon={<Subscript size={14} />}
                    active={isSubscript}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'subscript')}
                    title="Subscript"
                />
                <ToolbarButton
                    icon={<Superscript size={14} />}
                    active={isSuperscript}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'superscript')}
                    title="Superscript"
                />
            </div>

            <Separator orientation="vertical" className="h-5 mx-1 bg-gray-600" />

            {/* Alignment */}
            <div className="flex items-center gap-0.5">
                <ToolbarButton
                    icon={<AlignLeft size={14} />}
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left')}
                    title="Align Left"
                />
                <ToolbarButton
                    icon={<AlignCenter size={14} />}
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center')}
                    title="Align Center"
                />
                <ToolbarButton
                    icon={<AlignRight size={14} />}
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right')}
                    title="Align Right"
                />
                <ToolbarButton
                    icon={<AlignJustify size={14} />}
                    onClick={() => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify')}
                    title="Justify"
                />
            </div>
        </div>
    );
}
