export function About() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">About</h1>
        <p className="text-lg text-muted-foreground">
          This is a modern starter template built with the latest tools and best practices.
        </p>
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Tech Stack</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground">
            <li>Vite - Next generation frontend tooling</li>
            <li>React 18 - UI library</li>
            <li>TypeScript - Type safety</li>
            <li>Tailwind CSS - Utility-first CSS</li>
            <li>shadcn/ui - High-quality React components</li>
            <li>React Router - Client-side routing</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
