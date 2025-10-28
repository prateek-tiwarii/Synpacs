import { Button } from '@/components/ui/button'

export function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold tracking-tight">Welcome to synPac</h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          A modern React application built with Vite, Tailwind CSS, and shadcn/ui
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg">Get Started</Button>
          <Button size="lg" variant="outline">
            Learn More
          </Button>
        </div>
      </div>
    </div>
  )
}
