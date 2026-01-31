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
import { cn } from "@/lib/utils"

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
      await connectApp(appSlug)
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

  // Credentials form - not configured state
  if (!isConfigured) {
    return (
      <div className="space-y-5">
        <div className="text-sm text-muted-foreground">
          Configure Pipedream Connect to enable 3000+ app integrations for your AI agent.
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pd-client-id">Client ID</Label>
              <a
                href="https://pipedream.com/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
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
                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
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
            <div className="text-sm text-destructive flex items-center gap-2 p-3 rounded-xl status-indicator-error">
              <AlertCircle className="h-4 w-4" />
              {credentialsError}
            </div>
          )}

          <Button onClick={handleSaveCredentials} disabled={isSavingCredentials} className="mt-1">
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

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Connected accounts section
  const connectedSection = connectedAccounts.length > 0 && (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Connected Apps</h3>
        <Button variant="ghost" size="icon-sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4", isLoading && 'animate-spin')} />
        </Button>
      </div>
      <div className="grid gap-2">
        {connectedAccounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-3 rounded-xl glass-card border-system-green/20"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-system-green/15">
                <CheckCircle2 className="h-4 w-4 text-system-green" />
              </div>
              <div>
                <div className="text-sm font-medium text-card-foreground">{account.app.name || account.name}</div>
                <div className="text-xs text-muted-foreground">{account.app.name_slug}</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDisconnect(account.id)}
              disabled={disconnectingAccount === account.id}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
    <div className="space-y-5">
      {connectedSection}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Available Apps</h3>
          <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-muted/50">3000+ integrations</span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1 glass-scrollbar">
          {filteredApps.map((app) => {
            const connected = isAppConnected(app.name_slug)
            const account = getConnectedAccountForApp(app.name_slug)

            return (
              <div
                key={app.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl transition-all duration-200",
                  connected
                    ? "glass-card border-system-green/20"
                    : "glass-card hover:shadow-glass"
                )}
              >
                <div className="flex items-center gap-3">
                  {app.img_src ? (
                    <img
                      src={app.img_src}
                      alt={app.name}
                      className="h-9 w-9 rounded-lg shadow-glass-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shadow-glass-sm">
                      <Link2 className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-card-foreground">{app.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                      {app.description || app.name_slug}
                    </div>
                  </div>
                </div>

                {connected ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-system-green" />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => account && handleDisconnect(account.id)}
                      disabled={disconnectingAccount === account?.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                        <Link2 className="h-4 w-4 mr-1.5" />
                        Connect
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })}

          {filteredApps.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "No apps found" : "No apps available"}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          After connecting, click refresh to update the list. Connected apps will be available as tools for the AI agent.
        </p>
      </div>
    </div>
  )
}
