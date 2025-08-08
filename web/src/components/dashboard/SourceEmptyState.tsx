import { AlertCircle, Eye, EyeOff, Shield } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useCreateSource } from "~/hooks/useSource";
import { AccountEncryption } from "~/lib/encryption";

export function SourceEmptyState() {
  const [mode, setMode] = React.useState<"manual" | "m3u">("manual");

  // Source details
  const [accountName, setAccountName] = React.useState<string>("My Account");
  const [sourceName, setSourceName] = React.useState<string>("My Source");
  const [server, setServer] = React.useState<string>("");
  const [username, setUsername] = React.useState<string>("");
  const [password, setPassword] = React.useState<string>("");
  const [m3uUrl, setM3uUrl] = React.useState<string>("");

  // Security passphrase
  const [passphrase, setPassphrase] = React.useState<string>("");
  const [confirmPassphrase, setConfirmPassphrase] = React.useState<string>("");
  const [showPassphrase, setShowPassphrase] = React.useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = React.useState(false);
  const [passphraseError, setPassphraseError] = React.useState<string>("");

  const createSource = useCreateSource();
  const encryption = React.useMemo(() => new AccountEncryption(), []);

  // Validate passphrase on change
  React.useEffect(() => {
    if (passphrase) {
      const validation = encryption.validatePassphrase(passphrase);
      setPassphraseError(validation.valid ? "" : validation.message || "");
    }
  }, [passphrase, encryption]);

  function extractXtreamFromM3U(
    urlText: string,
  ): { server: string; username: string; password: string } | null {
    try {
      const parsed = new URL(urlText);
      const usernameParam = parsed.searchParams.get("username");
      const passwordParam = parsed.searchParams.get("password");
      if (!usernameParam || !passwordParam) return null;

      const origin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ":" + parsed.port : ""}`;
      return { server: origin, username: usernameParam, password: passwordParam };
    } catch {
      return null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (createSource.isPending) return;

    // Validate passphrase
    const validation = encryption.validatePassphrase(passphrase);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    if (passphrase !== confirmPassphrase) {
      toast.error("Passphrases don't match");
      return;
    }

    try {
      let sourceCredentials: { server: string; username: string; password: string };

      if (mode === "m3u") {
        const creds = extractXtreamFromM3U(m3uUrl.trim());
        if (!creds) {
          toast.error(
            "Invalid M3U URL. It must include username and password query params.",
          );
          return;
        }
        sourceCredentials = creds;
      } else {
        if (!server || !username || !password) {
          toast.error("Please fill in all connection details.");
          return;
        }
        sourceCredentials = { server, username, password };
      }

      // Initialize encryption with passphrase
      await encryption.initialize(passphrase);

      // Create account and source
      const result = await createSource.mutateAsync({
        accountName: accountName || "My Account",
        sourceName: sourceName || "My Source",
        providerType: "xtream",
        credentials: sourceCredentials,
        passphrase,
      });

      // Store passphrase hint in localStorage
      localStorage.setItem("passphrase_set", "true");
      localStorage.setItem("account_id", result.accountId);

      toast.success("Source created successfully! You can now reload the catalog.");

      // Reload the page to show the new source
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      console.error("Failed to create source", err);
      toast.error("Failed to create source. Please check your details.");
    }
  }

  function setDemoDefaults() {
    setServer("http://demo.xtream.codes");
    setUsername("demo");
    setPassword("demo");
    setSourceName("Demo Source");
  }

  function suggestPassphrase() {
    const suggested = encryption.generateSuggestedPassphrase();
    setPassphrase(suggested);
    setConfirmPassphrase(suggested);
    toast.info(`Suggested passphrase: ${suggested}`);
  }

  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Create Your First Source</h2>
          <p className="text-muted-foreground mt-2">
            Connect your IPTV service securely with end-to-end encryption
          </p>
        </div>

        {/* Security Info Banner */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">🔐 Zero-Knowledge Encryption</h3>
              <p className="text-muted-foreground text-sm">
                Your source credentials are encrypted with your passphrase before being
                stored. We never have access to your plaintext credentials or passphrase.
                If you forget your passphrase, you'll need to recreate your sources.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="bg-muted flex gap-2 rounded-lg p-1">
          <Button
            type="button"
            variant={mode === "manual" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setMode("manual")}
          >
            Manual Setup
          </Button>
          <Button
            type="button"
            variant={mode === "m3u" ? "default" : "ghost"}
            size="sm"
            className="flex-1"
            onClick={() => setMode("m3u")}
          >
            M3U URL
          </Button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Account & Passphrase Section */}
          <div className="bg-card space-y-4 rounded-lg border p-6">
            <div>
              <h3 className="mb-4 text-lg font-semibold">Security Setup</h3>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g., Family Account"
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <Label htmlFor="passphrase">
                      Security Passphrase <span className="text-red-500">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={suggestPassphrase}
                      className="text-xs"
                    >
                      Suggest one
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="passphrase"
                      type={showPassphrase ? "text" : "password"}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Enter 6+ characters (e.g., Fire42)"
                      className={passphraseError ? "border-red-500" : ""}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-7 w-7 p-0"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                    >
                      {showPassphrase ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {passphraseError && (
                    <p className="mt-1 text-xs text-red-500">{passphraseError}</p>
                  )}
                  {!passphraseError && passphrase && (
                    <p className="mt-1 text-xs text-green-600">✓ Strong passphrase</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirmPassphrase">
                    Confirm Passphrase <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassphrase"
                      type={showConfirmPassphrase ? "text" : "password"}
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      placeholder="Re-enter passphrase"
                      className={
                        confirmPassphrase && passphrase !== confirmPassphrase
                          ? "border-red-500"
                          : ""
                      }
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute top-1 right-1 h-7 w-7 p-0"
                      onClick={() => setShowConfirmPassphrase(!showConfirmPassphrase)}
                    >
                      {showConfirmPassphrase ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {confirmPassphrase && passphrase !== confirmPassphrase && (
                    <p className="mt-1 text-xs text-red-500">Passphrases don't match</p>
                  )}
                  {confirmPassphrase && passphrase === confirmPassphrase && (
                    <p className="mt-1 text-xs text-green-600">✓ Passphrases match</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                <p className="text-muted-foreground text-xs">
                  Remember this passphrase! You'll need it to access your sources on any
                  device. We cannot recover it if lost.
                </p>
              </div>
            </div>
          </div>

          {/* Source Details Section */}
          <div className="bg-card space-y-4 rounded-lg border p-6">
            <h3 className="text-lg font-semibold">Source Details</h3>

            <div>
              <Label htmlFor="sourceName">Source Name</Label>
              <Input
                id="sourceName"
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="e.g., Main IPTV"
              />
            </div>

            {mode === "manual" ? (
              <>
                <div>
                  <Label htmlFor="server">
                    Server URL <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="server"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    placeholder="http://example.com:8080"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="username">
                      Username <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Your username"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Label htmlFor="m3uUrl">
                  M3U URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="m3uUrl"
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="http://example.com/get.php?username=xxx&password=xxx&type=m3u"
                  required
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Paste your M3U playlist URL with username and password parameters
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={setDemoDefaults}
              disabled={createSource.isPending}
            >
              Use Demo Defaults
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={
                createSource.isPending ||
                !!passphraseError ||
                passphrase !== confirmPassphrase
              }
            >
              {createSource.isPending ? "Creating Source..." : "Create Secure Source"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
