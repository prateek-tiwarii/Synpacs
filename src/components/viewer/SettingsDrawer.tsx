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

        let newKey = e.key;
        if (e.ctrlKey) newKey = `Ctrl + ${newKey}`;
        if (e.shiftKey && e.key.length > 1) newKey = `Shift + ${newKey}`;
        if (e.altKey) newKey = `Alt + ${newKey}`;

        updateShortcut(recordingId, e.key); // We store the raw key for logic, but display name can be complex
        // Actually, let's store what we need for event.key comparison
        // If it's a letter, we usually care about case or just the letter.
        // The previous implementation used e.key.

        setRecordingId(null);
    }, [recordingId, updateShortcut]);

    useEffect(() => {
        if (recordingId) {
            window.addEventListener("keydown", handleKeyDown, true);
        }
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [recordingId, handleKeyDown]);

    const categories = ["Display Windows", "Tools", "Navigation", "Transform"] as const;

    const getDisplayKey = (key: string) => {
        if (key === " ") return "Space";
        if (key.length === 1) return key.toUpperCase();
        return key;
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[500px] bg-gray-950 border-gray-800 text-gray-100 p-0 overflow-hidden flex flex-col">
                <SheetHeader className="p-6 border-b border-gray-800">
                    <SheetTitle className="text-gray-100 flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-500" />
                        Settings
                    </SheetTitle>
                    <SheetDescription className="text-gray-400">
                        Configure your viewer preferences and customize keyboard shortcuts.
                    </SheetDescription>
                </SheetHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="space-y-8">
                        {/* Multi Monitor Setting */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">
                                <Monitor className="w-4 h-4" />
                                Multi Monitor Setting
                            </div>
                            <RadioGroup
                                value={monitor}
                                onValueChange={setMonitor}
                                className="grid grid-cols-2 gap-4"
                            >
                                <div>
                                    <RadioGroupItem
                                        value="screen1"
                                        id="screen1"
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor="screen1"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-gray-800 bg-gray-900/50 p-4 hover:bg-gray-800 hover:text-gray-100 peer-data-[state=checked]:border-blue-500 [&:has([data-state=checked])]:border-blue-500 cursor-pointer transition-all"
                                    >
                                        <span className="text-sm font-medium">Screen 1</span>
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
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-gray-800 bg-gray-900/50 p-4 hover:bg-gray-800 hover:text-gray-100 peer-data-[state=checked]:border-blue-500 [&:has([data-state=checked])]:border-blue-500 cursor-pointer transition-all"
                                    >
                                        <span className="text-sm font-medium">Screen 2</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </section>

                        <Separator className="bg-gray-800" />

                        {/* Keyboard Shortcuts */}
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">
                                    <Keyboard className="w-4 h-4" />
                                    Keyboard Shortcuts
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-[10px] text-gray-500 hover:text-gray-300 gap-1"
                                    onClick={() => {
                                        localStorage.removeItem("viewer_shortcuts");
                                        window.location.reload();
                                    }}
                                >
                                    <RotateCcw className="w-3 h-3" />
                                    Reset to Defaults
                                </Button>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 mb-4">
                                <div className="flex gap-2">
                                    <MousePointer2 className="w-4 h-4 text-blue-400 shrink-0" />
                                    <p className="text-xs text-blue-200/80 leading-relaxed">
                                        Click on a shortcut binding to change it. Press any key while recording to set the new binding.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {categories.map((cat) => (
                                    <div key={cat} className="space-y-2">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-tight">
                                            {cat}
                                        </h3>
                                        <div className="grid gap-2">
                                            {shortcuts
                                                .filter((s) => s.category === cat)
                                                .map((s) => (
                                                    <div
                                                        key={s.id}
                                                        className={`flex items-center justify-between text-sm py-1.5 px-2 rounded-md transition-colors ${recordingId === s.id
                                                            ? "bg-blue-600/20 border border-blue-500/50"
                                                            : "hover:bg-gray-900/50 border border-transparent"
                                                            }`}
                                                    >
                                                        <span className="text-gray-400">{s.label}</span>
                                                        <button
                                                            onClick={() => setRecordingId(recordingId === s.id ? null : s.id)}
                                                            className={`min-w-[40px] h-6 flex items-center justify-center rounded px-2 font-mono text-[11px] font-medium transition-all ${recordingId === s.id
                                                                ? "bg-blue-500 text-white animate-pulse"
                                                                : "bg-gray-800 text-gray-300 border border-gray-700 hover:border-gray-500"
                                                                }`}
                                                        >
                                                            {recordingId === s.id ? "???" : getDisplayKey(s.key)}
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

                <div className="p-4 border-t border-gray-800 bg-gray-900/20">
                    <p className="text-[10px] text-center text-gray-500">
                        Synpacs Viewer v1.0.0 • Settings are saved locally
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
};

export { SettingsDrawer };
