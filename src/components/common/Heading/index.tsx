export const Heading = ({ title, subtitle }: { title: string, subtitle?: string }) => {
    return (
        <div className="flex flex-col gap-1">
            <div className="text-2xl font-bold">{title}</div>
            {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
        </div>
    );
};

export default Heading;