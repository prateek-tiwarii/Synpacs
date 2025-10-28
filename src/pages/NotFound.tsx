export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <p className="text-2xl font-semibold">Page Not Found</p>
        <p className="text-lg text-muted-foreground">
          Sorry, the page you're looking for doesn't exist.
        </p>
        <a href="/" className="text-primary hover:underline text-lg">
          Go back home
        </a>
      </div>
    </div>
  )
}
