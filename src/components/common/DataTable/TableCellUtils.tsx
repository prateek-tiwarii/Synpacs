import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

/**
 * A cell component with copy-to-clipboard functionality
 */
interface CellWithCopyProps {
    content: string;
    cellId: string;
}

export const CellWithCopy = ({ content, cellId }: CellWithCopyProps) => {
    const [copiedCell, setCopiedCell] = useState<string | null>(null);

    const handleCopy = (text: string, cellId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCell(cellId);
        setTimeout(() => setCopiedCell(null), 2000);
    };

    return (
        <div className="group relative flex items-center min-w-0" title={content}>
            <span className="truncate pr-4">{content}</span>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(content, cellId);
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-100 rounded shrink-0"
            >
                {copiedCell === cellId ? (
                    <Check className="w-3 h-3 text-green-600" />
                ) : (
                    <Copy className="w-3 h-3 text-gray-600" />
                )}
            </button>
        </div>
    );
};

/**
 * Status badge cell with predefined color variants
 */
interface StatusCellProps {
    status: string;
}

export const StatusCell = ({ status }: StatusCellProps) => {
    return (
        <span
            className={`inline-flex items-center gap-1 ${status === 'Reported'
                    ? 'text-green-600'
                    : status === 'Unreported'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                }`}
        >
            <span
                className={`w-2 h-2 rounded-full ${status === 'Reported'
                        ? 'bg-green-600'
                        : status === 'Unreported'
                            ? 'bg-red-600'
                            : 'bg-yellow-600'
                    }`}
            />
            {status}
        </span>
    );
};

/**
 * Priority badge cell
 */
interface PriorityCellProps {
    priority?: string;
}

export const PriorityCell = ({ priority }: PriorityCellProps) => {
    if (!priority) return <span className="text-sm text-muted-foreground">-</span>;

    const getPriorityVariant = (priority: string) => {
        switch (priority.toLowerCase()) {
            case "high":
                return "destructive";
            case "medium":
                return "default";
            case "low":
                return "secondary";
            default:
                return "outline";
        }
    };

    return (
        <Badge variant={getPriorityVariant(priority)} className="truncate">
            {priority}
        </Badge>
    );
};

/**
 * Date formatter utility
 */
export const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return `${date.toLocaleDateString()}\n${date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    } catch {
        return dateString;
    }
};

/**
 * Date of birth formatter (handles YYYYMMDD format)
 */
export const formatDOB = (dob?: string): string => {
    if (!dob) return "N/A";
    // Format YYYYMMDD to readable format
    if (dob.length === 8) {
        const year = dob.substring(0, 4);
        const month = dob.substring(4, 6);
        const day = dob.substring(6, 8);
        return `${year}-${month}-${day}`;
    }
    return dob;
};

/**
 * Date cell component
 */
interface DateCellProps {
    date: string;
}

export const DateCell = ({ date }: DateCellProps) => {
    return (
        <div className="text-xs truncate" title={formatDate(date)}>
            {formatDate(date)}
        </div>
    );
};

/**
 * Age/Sex combined cell
 */
interface AgeSexCellProps {
    age: string;
    sex: string;
}

export const AgeSexCell = ({ age, sex }: AgeSexCellProps) => {
    return (
        <span className="text-sm truncate">
            {age}/{sex}
        </span>
    );
};
