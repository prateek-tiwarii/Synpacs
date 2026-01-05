import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Lock, AlertCircle, Activity } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { login } from '@/store/authSlice'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export function Auth() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { loading, error, isAuthenticated } = useAppSelector((state) => state.auth)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onLoginSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      await dispatch(login(data)).unwrap()
    } catch (err) {
      console.error('Login failed:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/25 mb-4">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            SynPACS
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Medical Imaging Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-50/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-800">
              Welcome back
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-50/80 border-red-200/60 text-red-700 rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-5">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium text-sm">
                      Email address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="you@example.com"
                          className="pl-10 h-11 bg-slate-100/50 border-slate-200 rounded-xl focus:border-teal-500 focus:ring-teal-500/20 focus:ring-2 focus:bg-slate-50 transition-all placeholder:text-slate-400"
                          type="email"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-500 text-xs mt-1" />
                  </FormItem>
                )}
              />

              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium text-sm">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Enter your password"
                          className="pl-10 h-11 bg-slate-100/50 border-slate-200 rounded-xl focus:border-teal-500 focus:ring-teal-500/20 focus:ring-2 focus:bg-slate-50 transition-all placeholder:text-slate-400"
                          type="password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-red-500 text-xs mt-1" />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end">
                <a
                  href="#"
                  className="text-teal-600 hover:text-teal-700 font-medium text-sm transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-medium rounded-xl shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-xs mt-6">
          © 2026 SynPACS. Secure medical imaging.
        </p>
      </div>
    </div>
  )
}
