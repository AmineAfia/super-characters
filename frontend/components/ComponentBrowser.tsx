"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Loader2, 
  Search, 
  Link2, 
  Unlink, 
  ExternalLink, 
  RefreshCw,
  CheckCircle2,
  AlertCircle 
} from "lucide-react"
import {
  isPipedreamConfigured,
  setPipedreamCredentials,
  listApps,
  listConnectedAccounts,
  deleteConnectedAccount,
  connectApp,
  type PipedreamApp,
  type ConnectedAccount,
  POPULAR_APPS,
} from "@/lib/pipedream/client"

interface ComponentBrowserProps {
  onConnectionChange?: () => void
}

export default function ComponentBrowser({ onConnectionChange }: ComponentBrowserProps) {
  const [isConfigured, setIsConfigured] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [apps, setApps] = useState<PipedreamApp[]>([])
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([])
  const [connectingApp, setConnectingApp] = useState<string | null>(null)
  const [disconnectingAccount, setDisconnectingAccount] = useState<string | null>(null)

  // Credentials form state
  const [clientId, setClientId] = useState("")
  const [clientSecret, setClientSecret] = useState("")
  const [projectId, setProjectId] = useState("")
  const [isSavingCredentials, setIsSavingCredentials] = useState(false)
  const [credentialsError, setCredentialsError] = useState("")

  // Check if configured on mount
  useEffect(() => {
    checkConfiguration()
  }, [])

  const checkConfiguration = async () => {
    setIsLoading(true)
    try {
      const configured = await isPipedreamConfigured()
      setIsConfigured(configured)
      if (configured) {
        await loadAppsAndAccounts()
      }
    } catch (e) {
      console.error("Error checking Pipedream configuration:", e)
    } finally {
      setIsLoading(false)
    }
  }

  const loadAppsAndAccounts = async () => {
    try {
      const [appsData, accountsData] = await Promise.all([
        listApps("", 50),
        listConnectedAccounts(),
      ])
      setApps(appsData)
      setConnectedAccounts(accountsData)
    } catch (e) {
      console.error("Error loading apps/accounts:", e)
    }
  }

  const handleSaveCredentials = async () => {
    if (!clientId || !clientSecret || !projectId) {
      setCredentialsError("All fields are required")
      return
    }

    setIsSavingCredentials(true)
    setCredentialsError("")

    try {
      const result = await setPipedreamCredentials(clientId, clientSecret, projectId, "development")
      if (result) {
        setCredentialsError(result)
      } else {
        setIsConfigured(true)
        await loadAppsAndAccounts()
      }
    } catch (e) {
      setCredentialsError(`Error: ${e}`)
    } finally {
      setIsSavingCredentials(false)
    }
  }

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!isConfigured) return

    try {
      const appsData = await listApps(query, 50)
      setApps(appsData)
    } catch (e) {
      console.error("Error searching apps:", e)
    }
  }, [isConfigured])

  const handleConnect = async (appSlug: string) => {
    setConnectingApp(appSlug)
    try {
      const success = await connectApp(appSlug)
      if (success) {
        // Show a message that OAuth flow is opening
        // User needs to complete in browser and then refresh
      }
    } catch (e) {
      console.error("Error connecting app:", e)
    } finally {
      setConnectingApp(null)
    }
  }

  const handleDisconnect = async (accountId: string) => {
    setDisconnectingAccount(accountId)
    try {
      const success = await deleteConnectedAccount(accountId)
      if (success) {
        setConnectedAccounts(prev => prev.filter(a => a.id !== accountId))
        onConnectionChange?.()
      }
    } catch (e) {
      console.error("Error disconnecting account:", e)
    } finally {
      setDisconnectingAccount(null)
    }
  }

  const handleRefresh = async () => {
    setIsLoading(true)
    await loadAppsAndAccounts()
    setIsLoading(false)
    onConnectionChange?.()
  }

  const isAppConnected = (appSlug: string) => {
    return connectedAccounts.some(a => a.app.name_slug === appSlug)
  }

  const getConnectedAccountForApp = (appSlug: string) => {
    return connectedAccounts.find(a => a.app.name_slug === appSlug)
  }

  // Show credentials form if not configured
  if (!isConfigured) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          Configure Pipedream Connect to enable 3000+ app integrations for your AI agent.
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pd-client-id">Client ID</Label>
              <a
                href="https://pipedream.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Get credentials <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="pd-client-id"
              type="text"
              placeholder="oa_xxxxxxxx"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="pd-client-secret">Client Secret</Label>
            <Input
              id="pd-client-secret"
              type="password"
              placeholder="Enter your client secret"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pd-project-id">Project ID</Label>
              <a
                href="https://pipedream.com/projects"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                Get project ID <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <Input
              id="pd-project-id"
              type="text"
              placeholder="proj_xxxxxxxx"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            />
          </div>

          {credentialsError && (
            <div className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {credentialsError}
            </div>
          )}

          <Button onClick={handleSaveCredentials} disabled={isSavingCredentials} className="mt-2">
            {isSavingCredentials ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Credentials"
            )}
          </Button>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Connected accounts section
  const connectedSection = connectedAccounts.length > 0 && (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Connected Apps</h3>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      <div className="grid gap-2">
        {connectedAccounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-sm font-medium">{account.app.name || account.name}</div>
                <div className="text-xs text-muted-foreground">{account.app.name_slug}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDisconnect(account.id)}
              disabled={disconnectingAccount === account.id}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              {disconnectingAccount === account.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )

  // Filter apps based on search
  const filteredApps = searchQuery
    ? apps
    : apps.filter(app => POPULAR_APPS.includes(app.name_slug)).slice(0, 15)

  return (
    <div className="space-y-4">
      {connectedSection}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Available Apps</h3>
          <span className="text-xs text-muted-foreground">3000+ integrations</span>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
          {filteredApps.map((app) => {
            const connected = isAppConnected(app.name_slug)
            const account = getConnectedAccountForApp(app.name_slug)

            return (
              <div
                key={app.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  connected
                    ? "bg-green-500/10 border-green-500/20"
                    : "bg-card border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  {app.img_src ? (
                    <img
                      src={app.img_src}
                      alt={app.name}
                      className="h-8 w-8 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                      <Link2 className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{app.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {app.description || app.name_slug}
                    </div>
                  </div>
                </div>

                {connected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => account && handleDisconnect(account.id)}
                      disabled={disconnectingAccount === account?.id}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      {disconnectingAccount === account?.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(app.name_slug)}
                    disabled={connectingApp === app.name_slug}
                  >
                    {connectingApp === app.name_slug ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="h-4 w-4 mr-1" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })}

          {filteredApps.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No apps found" : "No apps available"}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          After connecting, click refresh to update the list. Connected apps will be available as tools for the AI agent.
        </p>
      </div>
    </div>
  )
}
