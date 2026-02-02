import { useState, useEffect, useCallback } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Monitor, Keyboard, RotateCcw, MousePointer2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useViewerContext } from "../ViewerLayout";

interface SettingsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Window presets with actual W/L values (must match ViewerHeader CT_PRESETS)
const WINDOW_PRESETS = [
    { id: "Window1", label: "Original", key: "1", wl: "Default" },
    { id: "Window2", label: "Lung", key: "2", wl: "W:1500 L:-500" },
    { id: "Window3", label: "Mediastinum", key: "3", wl: "W:350 L:50" },
    { id: "Window4", label: "Bone", key: "4", wl: "W:2500 L:500" },
    { id: "Window5", label: "Brain", key: "5", wl: "W:80 L:40" },
    { id: "Window6", label: "Stroke", key: "6", wl: "W:8 L:32" },
    { id: "Window7", label: "Liver", key: "7", wl: "W:150 L:30" },
];

const SettingsDrawer = ({ open, onOpenChange }: SettingsDrawerProps) => {
    const { shortcuts, updateShortcut } = useViewerContext();
    const [monitor, setMonitor] = useState<string>(() => {
        return localStorage.getItem("viewer_monitor_setting") || "screen1";
    });

    const [recordingId, setRecordingId] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem("viewer_monitor_setting", monitor);
    }, [monitor]);

    const handleKeyDown = useCallback((e: globalThis.KeyboardEvent) => {
        if (!recordingId) return;

        e.preventDefault();
        e.stopPropagation();

        // Ignore lonely modifier keys
        if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;

        const newKey = e.key;

        // Handle conflict: if this key is already assigned elsewhere, clear it (set to "")
        shortcuts.forEach((s) => {
            if (s.id !== recordingId && s.key === newKey) {
                updateShortcut(s.id, ""); // Clear conflicting shortcut
            }
        });

        updateShortcut(recordingId, newKey);
        setRecordingId(null);
    }, [recordingId, updateShortcut, shortcuts]);

    useEffect(() => {
        if (recordingId) {
            window.addEventListener("keydown", handleKeyDown, true);
        }
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [recordingId, handleKeyDown]);

    // Categories for editable shortcuts (excluding Display Windows)
    const editableCategories = ["Tools", "Navigation", "Transform"] as const;

    const getDisplayKey = (key: string) => {
        if (!key || key === "") return "---";
        if (key === " ") return "Space";
        if (key.length === 1) return key.toUpperCase();
        return key;
    };

    // Reset to empty shortcuts (not defaults)
    const resetToEmpty = () => {
        shortcuts.forEach((s) => {
            if (s.category !== "Display Windows") {
                updateShortcut(s.id, "");
            }
        });
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[340px] sm:w-[380px] bg-gray-950 border-gray-800 text-gray-100 p-0 overflow-hidden flex flex-col">
                <SheetHeader className="p-4 border-b border-gray-800">
                    <SheetTitle className="text-gray-100 flex items-center gap-2 text-sm">
                        <Monitor className="w-4 h-4 text-blue-500" />
                        Settings
                    </SheetTitle>
                    <SheetDescription className="text-gray-400 text-xs">
                        Configure viewer preferences and shortcuts.
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1 p-4">
                    <div className="space-y-5">
                        {/* Multi Monitor Setting */}
                        <section className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                <Monitor className="w-3 h-3" />
                                Monitor
                            </div>
                            <RadioGroup
                                value={monitor}
                                onValueChange={setMonitor}
                                className="grid grid-cols-2 gap-2"
                            >
                                <div>
                                    <RadioGroupItem
                                        value="screen1"
                                        id="screen1"
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor="screen1"
                                        className="flex items-center justify-center rounded border border-gray-800 bg-gray-900/50 p-2 text-xs hover:bg-gray-800 peer-data-[state=checked]:border-blue-500 cursor-pointer transition-all"
                                    >
                                        Screen 1
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem
                                        value="screen2"
                                        id="screen2"
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor="screen2"
                                        className="flex items-center justify-center rounded border border-gray-800 bg-gray-900/50 p-2 text-xs hover:bg-gray-800 peer-data-[state=checked]:border-blue-500 cursor-pointer transition-all"
                                    >
                                        Screen 2
                                    </Label>
                                </div>
                            </RadioGroup>
                        </section>

                        <Separator className="bg-gray-800" />

                        {/* Window Presets - Display Only (Not Editable) */}
                        <section className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                <Keyboard className="w-3 h-3" />
                                Window Presets
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                {WINDOW_PRESETS.map((preset) => (
                                    <div
                                        key={preset.id}
                                        className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-gray-900/30 border border-gray-800/50"
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-gray-300">{preset.label}</span>
                                            <span className="text-[9px] text-gray-500">{preset.wl}</span>
                                        </div>
                                        <span className="min-w-[24px] h-5 flex items-center justify-center rounded bg-gray-800 text-gray-400 font-mono text-[10px]">
                                            {preset.key}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <Separator className="bg-gray-800" />

                        {/* Editable Keyboard Shortcuts */}
                        <section className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    <Keyboard className="w-3 h-3" />
                                    Shortcuts
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[9px] text-gray-500 hover:text-gray-300 gap-1 px-2"
                                    onClick={resetToEmpty}
                                >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    Clear All
                                </Button>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded p-2">
                                <div className="flex gap-1.5">
                                    <MousePointer2 className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                                    <p className="text-[9px] text-blue-200/80 leading-relaxed">
                                        Click a shortcut to change it. Conflicts auto-clear previous binding.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {editableCategories.map((cat) => (
                                    <div key={cat} className="space-y-1">
                                        <h3 className="text-[9px] font-semibold text-gray-500 uppercase tracking-tight">
                                            {cat}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-1">
                                            {shortcuts
                                                .filter((s) => s.category === cat)
                                                .map((s) => (
                                                    <div
                                                        key={s.id}
                                                        className={`flex items-center justify-between text-[11px] py-1 px-1.5 rounded transition-colors ${recordingId === s.id
                                                            ? "bg-blue-600/20 border border-blue-500/50"
                                                            : "hover:bg-gray-900/50 border border-transparent"
                                                            }`}
                                                    >
                                                        <span className="text-gray-400 truncate text-[10px]">{s.label}</span>
                                                        <button
                                                            onClick={() => setRecordingId(recordingId === s.id ? null : s.id)}
                                                            className={`min-w-[28px] h-5 flex items-center justify-center rounded px-1.5 font-mono text-[10px] font-medium transition-all ${recordingId === s.id
                                                                ? "bg-blue-500 text-white animate-pulse"
                                                                : s.key
                                                                    ? "bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-500"
                                                                    : "bg-gray-900 text-gray-600 border border-gray-800 hover:border-gray-600"
                                                                }`}
                                                        >
                                                            {recordingId === s.id ? "..." : getDisplayKey(s.key)}
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </ScrollArea>

                <div className="p-3 border-t border-gray-800 bg-gray-900/20">
                    <p className="text-[9px] text-center text-gray-500">
                        Settings saved locally
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export { SettingsDrawer };
