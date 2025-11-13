"use client";

import Link from "next/link";
import { LoginForm } from "@components/LoginForm";
import { useSession } from "@hooks/useSession";
import { 
  ShieldCheckIcon, 
  UserGroupIcon, 
  KeyIcon,
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckCircleIcon
} from "@heroicons/react/24/outline";
import { useState } from "react";

export default function LoginPage() {
  const { data: session } = useSession();
  const [copiedRole, setCopiedRole] = useState<string | null>(null);

  const demoAccounts = [
    {
      role: "Administrator",
      email: "admin@demo.incidentpulse.com",
      password: "admin123",
      description: "Full system access with admin privileges",
      icon: ShieldCheckIcon,
      features: ["Full system access", "Team management", "System configuration"]
    },
    {
      role: "Operator",
      email: "operator@demo.incidentpulse.com", 
      password: "demo123456",
      description: "Incident management and response access",
      icon: UserGroupIcon,
      features: ["Create incidents", "Update status", "Team collaboration"]
    }
  ];

  const copyCredentials = (account: typeof demoAccounts[0]) => {
    const text = `Email: ${account.email}\nPassword: ${account.password}`;
    navigator.clipboard.writeText(text);
    setCopiedRole(account.role);
    setTimeout(() => setCopiedRole(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Left side - Form */}
        <div className="flex flex-1 flex-col justify-center py-10 px-4 sm:px-6 lg:px-20 xl:px-24">
          <div className="mx-auto w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-8">
              <Link href="/" className="inline-flex items-center space-x-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700">
                  <span className="text-xl font-bold text-white">IP</span>
                </div>
                <div className="text-left">
                  <span className="text-2xl font-bold text-gray-900">IncidentPulse</span>
                  <span className="block text-xs text-blue-600 font-medium">ENTERPRISE</span>
                </div>
              </Link>
              <h1 className="mt-8 text-3xl font-bold tracking-tight text-gray-900">
                Welcome back
              </h1>
              <p className="mt-3 text-gray-600">
                Sign in to your incident management dashboard
              </p>
            </div>

            {/* Login Form Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
              {session ? (
                <div className="text-center">
                  <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Already signed in
                  </h3>
                  <p className="text-gray-600 mb-4">
                    You are logged in as <strong>{session.email}</strong>
                  </p>
                  <Link
                    href="/dashboard"
                    className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Go to Dashboard
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <>
                  <LoginForm />
                  
                  {/* Demo Accounts Section */}
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <div className="flex items-center mb-4">
                      <KeyIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Demo Accounts
                      </h3>
                    </div>
                    <p className="text-xs text-gray-600 mb-4">
                      Try IncidentPulse with pre-configured demo accounts. Demo sessions are read-only—create your own
                      deployment to test write actions.
                    </p>

                    <div className="space-y-3">
                      {demoAccounts.map((account) => {
                        const Icon = account.icon;
                        const isCopied = copiedRole === account.role;
                        
                        return (
                          <div
                            key={account.role}
                            className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start space-x-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                                  <Icon className="h-4 w-4 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-semibold text-gray-900">
                                    {account.role}
                                  </h4>
                                  <p className="text-xs text-gray-600 mt-1">
                                    {account.description}
                                  </p>
                                  <div className="mt-2 space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-medium text-gray-500">Email:</span>
                                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 break-all">
                                          {account.email}
                                        </code>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs font-medium text-gray-500">Password:</span>
                                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 break-all">
                                          {account.password}
                                        </code>
                                      </div>
                                    </div>
                                  </div>
                              </div>
                              <button
                                onClick={() => copyCredentials(account)}
                                className="flex-shrink-0 ml-2 p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Copy credentials"
                              >
                                {isCopied ? (
                                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                ) : (
                                  <ClipboardDocumentIcon className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer Links */}
            <div className="mt-8 text-center">
              <p className="text-xs text-gray-500">
                Need access?{" "}
                <a
                  href="mailto:ades.salisu@gmail.com"
                  className="text-blue-600 hover:text-blue-500 font-medium"
                >
                  Contact your administrator
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Feature Showcase */}
        <div className="hidden lg:flex flex-1 bg-gradient-to-br from-blue-600 to-blue-800">
          <div className="flex flex-col justify-center px-12 py-12">
            <div className="max-w-md">
              <h2 className="text-3xl font-bold text-white mb-6">
                Enterprise Incident Management
              </h2>
              
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 mt-0.5">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Real-time Collaboration
                    </h3>
                    <p className="text-blue-100">
                      Work seamlessly with your team during critical incidents with live updates and shared context.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 mt-0.5">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Automated Status Pages
                    </h3>
                    <p className="text-blue-100">
                      Keep stakeholders informed with automated, accurate status updates and transparent communication.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 mt-0.5">
                    <CheckCircleIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Comprehensive Analytics
                    </h3>
                    <p className="text-blue-100">
                      Track MTTR, response times, and team performance with detailed reporting and insights.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-500/20 rounded-lg border border-blue-400/30">
                <p className="text-sm text-blue-100">
                  <strong>Pro Tip:</strong> Use the demo accounts to explore all features without affecting production data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
