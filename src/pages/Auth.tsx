import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Mail, Lock, User } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export function Auth() {
  const [isLogin, setIsLogin] = useState(true)

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onLoginSubmit = (data: z.infer<typeof loginSchema>) => {
    console.log('Login:', data)
    alert(`Welcome back! ${data.email}`)
  }

  const onSignupSubmit = (data: z.infer<typeof signupSchema>) => {
    console.log('Signup:', data)
    alert(`Welcome! Account created for ${data.email}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left Side - Branding */}
          <div className="hidden lg:block space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-400 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">S</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">synPac</span>
              </div>

              <h1 className="text-5xl font-bold text-gray-900 leading-tight">
                Secure Medical Reports, Efficient Patient Care
              </h1>
              <p className="text-xl text-gray-600">
                {isLogin 
                  ? 'Access patient medical reports and manage patient allocations with ease.'
                  : 'Join our platform to streamline medical record management and patient care delivery.'}
              </p>
            </div>

            {/* Features */}
            <div className="space-y-4 pt-8">
              {[
                { icon: '�', title: 'Medical Reports', desc: 'Secure patient medical record management' },
                { icon: '👨‍⚕️', title: 'Doctor Allocation', desc: 'Assign patients to doctors efficiently' },
                { icon: '�', title: 'PAC Editor', desc: 'View and edit reports in integrated editor' },
              ].map((feature, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-2xl">{feature.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{feature.title}</p>
                    <p className="text-sm text-gray-600">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Auth Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
            <div className="space-y-8">
              {/* Header */}
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-gray-900">
                  {isLogin ? 'Welcome to synPac' : 'Create Your Account'}
                </h2>
                <p className="text-gray-600">
                  {isLogin
                    ? "Sign in to manage medical reports and patient allocations"
                    : "Register as a doctor or healthcare provider"}
                </p>
              </div>

              {/* Form */}
              {isLogin ? (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 font-medium">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                              <Input
                                placeholder="you@example.com"
                                className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                type="email"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                              <Input
                                placeholder="••••••••"
                                className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                type="password"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <div className="text-right">
                      <a href="#" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                        Forgot password?
                      </a>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                      Sign In
                    </Button>
                  </form>
                </Form>
              ) : (
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-5">
                    <FormField
                      control={signupForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 font-medium">Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                              <Input
                                placeholder="John Doe"
                                className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 font-medium">Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                              <Input
                                placeholder="you@example.com"
                                className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                type="email"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                              <Input
                                placeholder="••••••••"
                                className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                type="password"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={signupForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 font-medium">Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 h-5 w-5 text-blue-400" />
                              <Input
                                placeholder="••••••••"
                                className="pl-10 h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                                type="password"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                    >
                      Create Account
                    </Button>
                  </form>
                </Form>
              )}

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-600">or</span>
                </div>
              </div>

              {/* Google Sign In */}
              <Button
        variant="outline"
            className="w-full h-12 border-2 border-black !bg-white !text-black hover:!bg-gray-100 font-semibold rounded-lg transition-all"
>
  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
  Continue with Google
</Button>


              {/* Toggle */}
              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-gray-600">
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-white hover:text-gray-200 font-semibold"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
