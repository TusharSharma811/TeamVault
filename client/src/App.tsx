import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import "./App.css";
import { Icon } from "./components/Icon";
import { Navbar } from "./components/Navbar";
import Axios, { API_BASE_URL, TOKEN_KEY } from "./lib/axios";
import { Landing } from "./pages/landing";
import type { AuthMode, AuthValues } from "./pages/landing";
import type {
  AuthResponse,
  FileObject,
  Provider,
  StorageConnection,
  User,
} from "./types";

const USER_KEY = "teamvault_user";

const providerLabel: Record<Provider, string> = {
  "aws-s3": "AWS S3",
  gcs: "Google Cloud Storage",
};

const signedExpiryOptions = [
  { label: "15 min", value: 900 },
  { label: "1 hour", value: 3600 },
  { label: "12 hours", value: 43_200 },
  { label: "24 hours", value: 86_400 },
];

const shareExpiryOptions = [
  ...signedExpiryOptions,
  { label: "7 days", value: 604_800 },
];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
const folderInputAttributes = {
  directory: "",
  webkitdirectory: "",
} as Record<string, string>;

const credentialGuides: Record<
  Provider,
  { title: string; steps: string[]; fields: string[] }
> = {
  "aws-s3": {
    title: "AWS S3 credential steps",
    steps: [
      "Create or choose an S3 bucket for TeamVault files.",
      "Create an IAM user or access key scoped to that bucket.",
      "Allow PutObject, GetObject, and DeleteObject for the bucket path.",
      "Paste the access key ID, secret access key, region, and bucket name here.",
    ],
    fields: ["Bucket", "Region", "Access key ID", "Secret access key"],
  },
  gcs: {
    title: "Google Cloud Storage credential steps",
    steps: [
      "Create or choose a Google Cloud Storage bucket.",
      "Create a service account for TeamVault access.",
      "Grant object read, write, delete, and signed URL permissions.",
      "Download the service account JSON and paste the full JSON here.",
    ],
    fields: ["Bucket", "Service account JSON"],
  },
};

interface ConnectionFormState {
  name: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  serviceAccountJSON: string;
  defaultPrefix: string;
}

interface SignedUrlResponse {
  url: string;
  expiresIn: number;
}

interface ShareResponse {
  token: string;
  expiresAt: string;
}

type UploadPickMode = "files" | "folder";
type WorkspaceTab = "files" | "access" | "connections";

function createConnectionForm(): ConnectionFormState {
  return {
    name: "",
    bucket: "",
    region: "",
    accessKeyId: "",
    secretAccessKey: "",
    serviceAccountJSON: "",
    defaultPrefix: "",
  };
}

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function itemId(item: { _id?: string; id?: string }) {
  return item._id || item.id || "";
}

function readableError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string } | undefined;
    return data?.error || error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** power;
  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function fileRelativePath(file: File) {
  return file.webkitRelativePath || file.name;
}

function formatDate(value?: string) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function makeShareUrl(token: string) {
  return `${API_BASE_URL.replace(/\/+$/, "")}/shares/${token}`;
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authValues, setAuthValues] = useState<AuthValues>({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [connections, setConnections] = useState<StorageConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [files, setFiles] = useState<FileObject[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [workspaceError, setWorkspaceError] = useState("");
  const [notice, setNotice] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("files");
  const [provider, setProvider] = useState<Provider>("aws-s3");
  const [connectionForm, setConnectionForm] = useState(createConnectionForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadPickMode, setUploadPickMode] = useState<UploadPickMode>("files");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [folderInputKey, setFolderInputKey] = useState(0);
  const [uploadPrefix, setUploadPrefix] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [connectionUserId, setConnectionUserId] = useState("");
  const [fileUserSelections, setFileUserSelections] = useState<
    Record<string, string>
  >({});
  const [signedExpiry, setSignedExpiry] = useState(3600);
  const [shareExpiry, setShareExpiry] = useState(3600);
  const [busyAction, setBusyAction] = useState("");

  const selectedConnection = useMemo(
    () =>
      connections.find((connection) => itemId(connection) === selectedConnectionId) ||
      null,
    [connections, selectedConnectionId]
  );

  const totalBytes = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files]
  );

  const selectedUploadBytes = useMemo(
    () => selectedFiles.reduce((total, file) => total + file.size, 0),
    [selectedFiles]
  );

  const connectionOwner = selectedConnection?.owner === user?.id;

  const userLabel = useCallback(
    (id: string) => {
      if (id === user?.id) return `${user.name} (you)`;
      const found = users.find((teamUser) => teamUser.id === id);
      return found ? `${found.name} (${found.email})` : id.slice(0, 10);
    },
    [user, users]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
    setConnections([]);
    setSelectedConnectionId("");
    setFiles([]);
    setUsers([]);
    setNotice("");
    setWorkspaceError("");
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!token) return;

    setIsRefreshing(true);
    setWorkspaceError("");

    try {
      const [meResponse, connectionsResponse, usersResponse] = await Promise.all([
        Axios.get<User>("/auth/me"),
        Axios.get<StorageConnection[]>("/storage/connections"),
        Axios.get<User[]>("/auth/users"),
      ]);

      setUser(meResponse.data);
      localStorage.setItem(USER_KEY, JSON.stringify(meResponse.data));
      setConnections(connectionsResponse.data);
      setUsers(usersResponse.data);
      setSelectedConnectionId((previous) => {
        const stillExists = connectionsResponse.data.some(
          (connection) => itemId(connection) === previous
        );
        if (previous && stillExists) return previous;
        return connectionsResponse.data[0]
          ? itemId(connectionsResponse.data[0])
          : "";
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setAuthError("Your session expired. Sign in again.");
        handleLogout();
        return;
      }
      setWorkspaceError(readableError(error));
    } finally {
      setIsRefreshing(false);
    }
  }, [handleLogout, token]);

  const loadFiles = useCallback(
    async (connectionId: string) => {
      if (!token || !connectionId) {
        setFiles([]);
        return;
      }

      setFilesLoading(true);
      setWorkspaceError("");

      try {
        const response = await Axios.get<FileObject[]>("/files", {
          params: { connectionId },
        });
        setFiles(response.data);
      } catch (error) {
        setWorkspaceError(readableError(error));
      } finally {
        setFilesLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) void loadWorkspace();
  }, [loadWorkspace, token]);

  useEffect(() => {
    void loadFiles(selectedConnectionId);
  }, [loadFiles, selectedConnectionId]);

  useEffect(() => {
    if (!notice && !workspaceError) return undefined;
    const timer = window.setTimeout(() => {
      setNotice("");
      setWorkspaceError("");
    }, 6500);
    return () => window.clearTimeout(timer);
  }, [notice, workspaceError]);

  function updateAuthValue(field: keyof AuthValues, value: string) {
    setAuthValues((current) => ({ ...current, [field]: value }));
  }

  function updateConnectionValue(field: keyof ConnectionFormState, value: string) {
    setConnectionForm((current) => ({ ...current, [field]: value }));
  }

  function handleSelectedFiles(fileList: FileList | null, mode: UploadPickMode) {
    const nextFiles = Array.from(fileList || []);
    setUploadPickMode(mode);

    if (!nextFiles.length) {
      setSelectedFiles([]);
      return;
    }

    const nextBytes = nextFiles.reduce((total, file) => total + file.size, 0);
    if (nextBytes > MAX_UPLOAD_BYTES) {
      setSelectedFiles([]);
      setWorkspaceError("Upload selection must be 5GB or smaller.");
      setFileInputKey((current) => current + 1);
      setFolderInputKey((current) => current + 1);
      return;
    }

    setWorkspaceError("");
    setSelectedFiles(nextFiles);
    setNotice(
      `${nextFiles.length} ${nextFiles.length === 1 ? "item" : "items"} ready to upload.`
    );
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        authMode === "login"
          ? {
              email: authValues.email,
              password: authValues.password,
            }
          : authValues;
      const response = await Axios.post<AuthResponse>(endpoint, payload);

      localStorage.setItem(TOKEN_KEY, response.data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
      setToken(response.data.token);
      setUser(response.data.user);
      setAuthValues({ name: "", email: "", password: "" });
    } catch (error) {
      setAuthError(readableError(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleCreateConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create-connection");
    setWorkspaceError("");
    setNotice("");

    try {
      let payload:
        | {
            provider: "aws-s3";
            name: string;
            bucket: string;
            region: string;
            accessKeyId: string;
            secretAccessKey: string;
            defaultPrefix?: string;
            allowedUsers: string[];
          }
        | {
            provider: "gcs";
            name: string;
            bucket: string;
            serviceAccountJSON: unknown;
            defaultPrefix?: string;
            allowedUsers: string[];
          };

      if (provider === "aws-s3") {
        payload = {
          provider,
          name: connectionForm.name,
          bucket: connectionForm.bucket,
          region: connectionForm.region,
          accessKeyId: connectionForm.accessKeyId,
          secretAccessKey: connectionForm.secretAccessKey,
          defaultPrefix: connectionForm.defaultPrefix || undefined,
          allowedUsers: [],
        };
      } else {
        let serviceAccountJSON: unknown;
        try {
          serviceAccountJSON = JSON.parse(connectionForm.serviceAccountJSON);
        } catch {
          setWorkspaceError("GCS service account JSON is not valid.");
          return;
        }

        payload = {
          provider,
          name: connectionForm.name,
          bucket: connectionForm.bucket,
          serviceAccountJSON,
          defaultPrefix: connectionForm.defaultPrefix || undefined,
          allowedUsers: [],
        };
      }

      const response = await Axios.post<StorageConnection>(
        "/storage/connections",
        payload
      );
      setConnections((current) => [response.data, ...current]);
      setSelectedConnectionId(itemId(response.data));
      setConnectionForm(createConnectionForm());
      setProvider("aws-s3");
      setActiveTab("files");
      setNotice("Storage connection added.");
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedConnection) {
      setWorkspaceError("Select a storage connection first.");
      return;
    }
    if (!selectedFiles.length) {
      setWorkspaceError("Choose files or a folder to upload.");
      return;
    }
    if (selectedUploadBytes > MAX_UPLOAD_BYTES) {
      setWorkspaceError("Upload limit is 5GB per request.");
      return;
    }

    setBusyAction("upload");
    setUploadProgress(0);
    setWorkspaceError("");
    setNotice("");

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("connectionId", selectedConnectionId);
      formData.append(
        "relativePaths",
        JSON.stringify(selectedFiles.map(fileRelativePath))
      );
      if (uploadPrefix.trim()) formData.append("keyPrefix", uploadPrefix.trim());

      const response = await Axios.post<FileObject[]>("/files/upload", formData, {
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        },
      });
      setFiles((current) => [...response.data, ...current]);
      setSelectedFiles([]);
      setUploadPrefix("");
      setFileInputKey((current) => current + 1);
      setFolderInputKey((current) => current + 1);
      setNotice(
        `${response.data.length} ${response.data.length === 1 ? "item" : "items"} uploaded.`
      );
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
      setUploadProgress(0);
    }
  }

  async function handleSearchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("search-users");
    setWorkspaceError("");

    try {
      const response = await Axios.get<User[]>("/auth/users", {
        params: { q: userSearch },
      });
      setUsers(response.data);
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleConnectionWhitelist(userId: string, action: "add" | "remove") {
    if (!selectedConnectionId || !userId) return;

    setBusyAction(`connection-${action}`);
    setWorkspaceError("");

    try {
      const response = await Axios.post<StorageConnection>(
        `/storage/connections/${selectedConnectionId}/whitelist`,
        {
          add: action === "add" ? [userId] : [],
          remove: action === "remove" ? [userId] : [],
        }
      );
      setConnections((current) =>
        current.map((connection) =>
          itemId(connection) === selectedConnectionId ? response.data : connection
        )
      );
      setConnectionUserId("");
      setNotice("Workspace access updated.");
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleFileWhitelist(
    file: FileObject,
    userId: string,
    action: "add" | "remove"
  ) {
    const fileId = itemId(file);
    if (!fileId || !userId) return;

    setBusyAction(`file-${action}-${fileId}`);
    setWorkspaceError("");

    try {
      const response = await Axios.post<FileObject>(`/files/${fileId}/whitelist`, {
        add: action === "add" ? [userId] : [],
        remove: action === "remove" ? [userId] : [],
      });
      setFiles((current) =>
        current.map((item) => (itemId(item) === fileId ? response.data : item))
      );
      setFileUserSelections((current) => ({ ...current, [fileId]: "" }));
      setNotice("File access updated.");
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleSignedUrl(file: FileObject) {
    const fileId = itemId(file);
    if (!fileId) return;

    setBusyAction(`signed-${fileId}`);
    setWorkspaceError("");
    setNotice("");

    try {
      const response = await Axios.post<SignedUrlResponse>(
        `/files/${fileId}/signed-url`,
        { expiresIn: signedExpiry }
      );
      await copyToClipboard(response.data.url);
      window.open(response.data.url, "_blank", "noopener,noreferrer");
      setNotice(`Signed URL copied for ${file.name}.`);
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleShareLink(file: FileObject) {
    const fileId = itemId(file);
    if (!fileId) return;

    setBusyAction(`share-${fileId}`);
    setWorkspaceError("");
    setNotice("");

    try {
      const response = await Axios.post<ShareResponse>("/shares", {
        fileId,
        expiresIn: shareExpiry,
      });
      const shareUrl = makeShareUrl(response.data.token);
      await copyToClipboard(shareUrl);
      setNotice(`Share link copied. Expires ${formatDate(response.data.expiresAt)}.`);
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
    }
  }

  async function handleDeleteFile(file: FileObject) {
    const fileId = itemId(file);
    if (!fileId || !window.confirm(`Delete ${file.name}?`)) return;

    setBusyAction(`delete-${fileId}`);
    setWorkspaceError("");

    try {
      await Axios.delete(`/files/${fileId}`);
      setFiles((current) => current.filter((item) => itemId(item) !== fileId));
      setNotice(`${file.name} deleted.`);
    } catch (error) {
      setWorkspaceError(readableError(error));
    } finally {
      setBusyAction("");
    }
  }

  if (!token || !user) {
    return (
      <Landing
        authError={authError}
        authMode={authMode}
        authValues={authValues}
        isLoading={isAuthenticating}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
        onValueChange={updateAuthValue}
      />
    );
  }

  const providerBreakdown = connections.reduce(
    (counts, connection) => ({
      ...counts,
      [connection.provider]: counts[connection.provider] + 1,
    }),
    { "aws-s3": 0, gcs: 0 } satisfies Record<Provider, number>
  );
  const connectionAllowedUsers = selectedConnection?.allowedUsers || [];
  const workspaceMemberIds = new Set(connectionAllowedUsers);
  const selectedConnectionProvider = selectedConnection
    ? providerLabel[selectedConnection.provider]
    : "No connection";
  const credentialGuide = credentialGuides[provider];

  return (
    <div className="app-shell">
      <Navbar
        isRefreshing={isRefreshing}
        onLogout={handleLogout}
        onRefresh={() => void loadWorkspace()}
        user={user}
      />

      <div className="toast-stack" aria-live="polite">
        {workspaceError ? (
          <div className="toast error" role="alert">
            <Icon name="alert" size={18} />
            {workspaceError}
          </div>
        ) : null}
        {notice ? (
          <div className="toast success" role="status">
            <Icon name="check" size={18} />
            {notice}
          </div>
        ) : null}
      </div>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">Clouds</span>
              <h2>Connections</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => setActiveTab("connections")}
              title="Add connection"
              type="button"
            >
              <Icon name="plus" size={18} />
            </button>
          </div>

          <div className="connection-list">
            {connections.length ? (
              connections.map((connection) => {
                const id = itemId(connection);
                return (
                  <button
                    className={`connection-item ${
                      id === selectedConnectionId ? "selected" : ""
                    }`}
                    key={id}
                    onClick={() => {
                      setSelectedConnectionId(id);
                      setActiveTab("files");
                    }}
                    type="button"
                  >
                    <span className="connection-icon">
                      <Icon
                        name={connection.provider === "aws-s3" ? "database" : "cloud"}
                        size={19}
                      />
                    </span>
                    <span>
                      <strong>{connection.name}</strong>
                      <small>{connection.bucket}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="empty-state compact">
                <Icon name="cloud" size={23} />
                <span>No connections yet</span>
              </div>
            )}
          </div>

          <button
            className="primary-button full-width"
            onClick={() => setActiveTab("connections")}
            type="button"
          >
            <Icon name="plus" size={18} />
            New connection
          </button>
        </aside>

        <section className="main-panel">
          <section className="overview-panel">
            <div>
              <span className="eyebrow">Workspace</span>
              <h1>{selectedConnection?.name || "TeamVault dashboard"}</h1>
              <p>
                {selectedConnection
                  ? `${selectedConnectionProvider} bucket: ${selectedConnection.bucket}`
                  : "Add a storage connection to begin."}
              </p>
            </div>

            <div className="metric-grid">
              <article>
                <Icon name="database" size={20} />
                <strong>{connections.length}</strong>
                <span>connections</span>
              </article>
              <article>
                <Icon name="file" size={20} />
                <strong>{files.length}</strong>
                <span>files</span>
              </article>
              <article>
                <Icon name="upload" size={20} />
                <strong>{formatBytes(totalBytes)}</strong>
                <span>stored here</span>
              </article>
              <article>
                <Icon name="cloud" size={20} />
                <strong>
                  {providerBreakdown["aws-s3"]}/{providerBreakdown.gcs}
                </strong>
                <span>S3/GCS</span>
              </article>
            </div>
          </section>

          <nav className="tabs" aria-label="Workspace sections">
            <button
              className={activeTab === "files" ? "active" : ""}
              onClick={() => setActiveTab("files")}
              type="button"
            >
              <Icon name="file" size={18} />
              Files
            </button>
            <button
              className={activeTab === "access" ? "active" : ""}
              onClick={() => setActiveTab("access")}
              type="button"
            >
              <Icon name="users" size={18} />
              Access
            </button>
            <button
              className={activeTab === "connections" ? "active" : ""}
              onClick={() => setActiveTab("connections")}
              type="button"
            >
              <Icon name="cloud" size={18} />
              Connections
            </button>
          </nav>

          {activeTab === "files" ? (
            <section className="content-grid">
              <form className="tool-panel upload-panel" onSubmit={handleUpload}>
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">Upload</span>
                    <h2>New file</h2>
                  </div>
                  <Icon name="upload" size={22} />
                </div>

                <div className="segmented-control compact-tabs">
                  <button
                    className={uploadPickMode === "files" ? "active" : ""}
                    onClick={() => setUploadPickMode("files")}
                    type="button"
                  >
                    Files
                  </button>
                  <button
                    className={uploadPickMode === "folder" ? "active" : ""}
                    onClick={() => setUploadPickMode("folder")}
                    type="button"
                  >
                    Folder
                  </button>
                </div>

                {uploadPickMode === "files" ? (
                  <label className="file-drop">
                    <input
                      key={fileInputKey}
                      multiple
                      onChange={(event) =>
                        handleSelectedFiles(event.target.files, "files")
                      }
                      type="file"
                    />
                    <span>
                      <Icon name="file" size={22} />
                      {selectedFiles.length
                        ? `${selectedFiles.length} selected`
                        : "Choose files"}
                    </span>
                    <small>
                      {selectedFiles.length
                        ? formatBytes(selectedUploadBytes)
                        : "5GB max"}
                    </small>
                  </label>
                ) : (
                  <label className="file-drop">
                    <input
                      {...folderInputAttributes}
                      key={folderInputKey}
                      multiple
                      onChange={(event) =>
                        handleSelectedFiles(event.target.files, "folder")
                      }
                      type="file"
                    />
                    <span>
                      <Icon name="grid" size={22} />
                      {selectedFiles.length
                        ? `${selectedFiles.length} folder items`
                        : "Choose folder"}
                    </span>
                    <small>
                      {selectedFiles.length
                        ? formatBytes(selectedUploadBytes)
                        : "Desktop browsers"}
                    </small>
                  </label>
                )}

                {selectedFiles.length ? (
                  <div className="upload-summary">
                    <strong>{formatBytes(selectedUploadBytes)} selected</strong>
                    <span>
                      {selectedFiles.slice(0, 3).map(fileRelativePath).join(", ")}
                      {selectedFiles.length > 3 ? " ..." : ""}
                    </span>
                    {busyAction === "upload" ? (
                      <div className="progress-track" aria-label="Upload progress">
                        <span style={{ width: `${uploadProgress}%` }} />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="quiet-text">
                    Upload individual files from desktop or phone. Folder upload
                    is available where the browser supports directory picking.
                  </p>
                )}

                <label>
                  Prefix
                  <input
                    onChange={(event) => setUploadPrefix(event.target.value)}
                    placeholder={selectedConnection?.defaultPrefix || "reports/q2"}
                    value={uploadPrefix}
                  />
                </label>

                <button
                  className="primary-button"
                  disabled={
                    busyAction === "upload" ||
                    !selectedConnection ||
                    !selectedFiles.length
                  }
                >
                  <Icon name="upload" size={18} />
                  {busyAction === "upload" ? "Uploading..." : "Upload"}
                </button>
              </form>

              <section className="tool-panel file-panel">
                <div className="panel-title with-controls">
                  <div>
                    <span className="eyebrow">Files</span>
                    <h2>{selectedConnection?.bucket || "No bucket selected"}</h2>
                  </div>
                  <div className="expiry-controls">
                    <label>
                      Signed URL
                      <select
                        onChange={(event) =>
                          setSignedExpiry(Number(event.target.value))
                        }
                        value={signedExpiry}
                      >
                        {signedExpiryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Share link
                      <select
                        onChange={(event) =>
                          setShareExpiry(Number(event.target.value))
                        }
                        value={shareExpiry}
                      >
                        {shareExpiryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {filesLoading ? (
                  <div className="empty-state">
                    <Icon name="refresh" size={26} />
                    <span>Loading files...</span>
                  </div>
                ) : files.length ? (
                  <div className="file-list">
                    {files.map((file) => {
                      const fileId = itemId(file);
                      const isOwner = file.owner === user.id;
                      const canManageFile =
                        isOwner || selectedConnection?.owner === user.id;
                      const availableUsers = users.filter(
                        (teamUser) =>
                          workspaceMemberIds.has(teamUser.id) &&
                          teamUser.id !== file.owner &&
                          !file.allowedUsers.includes(teamUser.id)
                      );

                      return (
                        <article className="file-card" key={fileId}>
                          <div className="file-main">
                            <span className="file-icon">
                              <Icon name="file" size={22} />
                            </span>
                            <div>
                              <h3>{file.name}</h3>
                              <p>{file.key}</p>
                              <div className="meta-row">
                                <span>{formatBytes(file.size)}</span>
                                <span>{file.mimetype || "file"}</span>
                                <span>Owner: {userLabel(file.owner)}</span>
                                <span>{formatDate(file.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="file-actions">
                            <button
                              className="secondary-button"
                              disabled={busyAction === `signed-${fileId}`}
                              onClick={() => void handleSignedUrl(file)}
                              type="button"
                            >
                              <Icon name="external" size={17} />
                              Open
                            </button>
                            {canManageFile ? (
                              <button
                                className="secondary-button"
                                disabled={busyAction === `share-${fileId}`}
                                onClick={() => void handleShareLink(file)}
                                type="button"
                              >
                                <Icon name="link" size={17} />
                                Public link
                              </button>
                            ) : null}
                            {canManageFile ? (
                              <button
                                className="icon-button danger"
                                disabled={busyAction === `delete-${fileId}`}
                                onClick={() => void handleDeleteFile(file)}
                                title="Delete file"
                                type="button"
                              >
                                <Icon name="trash" size={17} />
                              </button>
                            ) : null}
                          </div>

                          {canManageFile ? (
                            <div className="access-row">
                              <select
                                onChange={(event) =>
                                  setFileUserSelections((current) => ({
                                    ...current,
                                    [fileId]: event.target.value,
                                  }))
                                }
                                value={fileUserSelections[fileId] || ""}
                              >
                                <option value="">Share with workspace member</option>
                                {availableUsers.map((teamUser) => (
                                  <option key={teamUser.id} value={teamUser.id}>
                                    {teamUser.name} - {teamUser.email}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="icon-button"
                                disabled={!fileUserSelections[fileId]}
                                onClick={() =>
                                  void handleFileWhitelist(
                                    file,
                                    fileUserSelections[fileId],
                                    "add"
                                  )
                                }
                                title="Grant file access"
                                type="button"
                              >
                                <Icon name="plus" size={17} />
                              </button>
                              {!availableUsers.length ? (
                                <span className="quiet-text">
                                  Add workspace members in Access before sharing files.
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <div className="pill-row">
                            {file.allowedUsers.length ? (
                              file.allowedUsers.map((allowedUserId) => (
                                <span className="access-pill" key={allowedUserId}>
                                  {userLabel(allowedUserId)}
                                  {canManageFile ? (
                                    <button
                                      onClick={() =>
                                        void handleFileWhitelist(
                                          file,
                                          allowedUserId,
                                          "remove"
                                        )
                                      }
                                      title="Remove file access"
                                      type="button"
                                    >
                                      x
                                    </button>
                                  ) : null}
                                </span>
                              ))
                            ) : (
                              <span className="quiet-text">No file whitelist</span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty-state">
                    <Icon name="file" size={28} />
                    <span>No files in this connection</span>
                  </div>
                )}
              </section>
            </section>
          ) : null}

          {activeTab === "access" ? (
            <section className="content-grid two-columns">
              <section className="tool-panel">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">Workspace access</span>
                    <h2>{selectedConnection?.name || "Select a connection"}</h2>
                  </div>
                  <Icon name="users" size={22} />
                </div>

                {selectedConnection ? (
                  <>
                    <div className="detail-list">
                      <span>Owner</span>
                      <strong>{userLabel(selectedConnection.owner)}</strong>
                      <span>Provider</span>
                      <strong>{providerLabel[selectedConnection.provider]}</strong>
                      <span>Bucket</span>
                      <strong>{selectedConnection.bucket}</strong>
                    </div>

                    {connectionOwner ? (
                      <div className="access-row">
                        <select
                          onChange={(event) => setConnectionUserId(event.target.value)}
                          value={connectionUserId}
                        >
                          <option value="">Add teammate</option>
                          {users
                            .filter(
                              (teamUser) =>
                                !connectionAllowedUsers.includes(teamUser.id)
                            )
                            .map((teamUser) => (
                              <option key={teamUser.id} value={teamUser.id}>
                                {teamUser.name} - {teamUser.email}
                              </option>
                            ))}
                        </select>
                        <button
                          className="icon-button"
                          disabled={!connectionUserId}
                          onClick={() =>
                            void handleConnectionWhitelist(connectionUserId, "add")
                          }
                          title="Grant workspace access"
                          type="button"
                        >
                          <Icon name="plus" size={17} />
                        </button>
                      </div>
                    ) : (
                      <p className="quiet-text">
                        Only the workspace owner can change access.
                      </p>
                    )}

                    <div className="pill-row stacked">
                      {connectionAllowedUsers.length ? (
                        connectionAllowedUsers.map((allowedUserId) => (
                          <span className="access-pill" key={allowedUserId}>
                            {userLabel(allowedUserId)}
                            {connectionOwner ? (
                              <button
                                onClick={() =>
                                  void handleConnectionWhitelist(
                                    allowedUserId,
                                    "remove"
                                  )
                                }
                                title="Remove workspace access"
                                type="button"
                              >
                                x
                              </button>
                            ) : null}
                          </span>
                        ))
                      ) : (
                        <span className="quiet-text">No connection whitelist</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state compact">
                    <Icon name="cloud" size={23} />
                    <span>No connection selected</span>
                  </div>
                )}
              </section>

              <section className="tool-panel">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">Directory</span>
                    <h2>Teammates</h2>
                  </div>
                  <Icon name="search" size={22} />
                </div>

                <form className="search-bar" onSubmit={handleSearchUsers}>
                  <input
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search name or email"
                    value={userSearch}
                  />
                  <button
                    className="icon-button"
                    disabled={busyAction === "search-users"}
                    title="Search users"
                    type="submit"
                  >
                    <Icon name="search" size={18} />
                  </button>
                </form>

                <div className="directory-list">
                  {users.length ? (
                    users.map((teamUser) => (
                      <article className="directory-user" key={teamUser.id}>
                        <span>{teamUser.name.slice(0, 1).toUpperCase()}</span>
                        <div>
                          <strong>{teamUser.name}</strong>
                          <small>{teamUser.email}</small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state compact">
                      <Icon name="users" size={22} />
                      <span>No users found</span>
                    </div>
                  )}
                </div>
              </section>
            </section>
          ) : null}

          {activeTab === "connections" ? (
            <section className="content-grid two-columns">
              <form className="tool-panel" onSubmit={handleCreateConnection}>
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">Storage</span>
                    <h2>Add connection</h2>
                  </div>
                  <Icon name="cloud" size={22} />
                </div>

                <div className="segmented-control compact-tabs">
                  <button
                    className={provider === "aws-s3" ? "active" : ""}
                    onClick={() => setProvider("aws-s3")}
                    type="button"
                  >
                    AWS S3
                  </button>
                  <button
                    className={provider === "gcs" ? "active" : ""}
                    onClick={() => setProvider("gcs")}
                    type="button"
                  >
                    GCS
                  </button>
                </div>

                <section className="credential-guide">
                  <div>
                    <Icon name="key" size={20} />
                    <strong>{credentialGuide.title}</strong>
                  </div>
                  <ol>
                    {credentialGuide.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div className="pill-row">
                    {credentialGuide.fields.map((field) => (
                      <span className="access-pill" key={field}>
                        {field}
                      </span>
                    ))}
                  </div>
                </section>

                <div className="form-grid">
                  <label>
                    Name
                    <input
                      onChange={(event) =>
                        updateConnectionValue("name", event.target.value)
                      }
                      placeholder="Production assets"
                      required
                      value={connectionForm.name}
                    />
                  </label>
                  <label>
                    Bucket
                    <input
                      onChange={(event) =>
                        updateConnectionValue("bucket", event.target.value)
                      }
                      placeholder="teamvault-prod"
                      required
                      value={connectionForm.bucket}
                    />
                  </label>
                  <label>
                    Prefix
                    <input
                      onChange={(event) =>
                        updateConnectionValue("defaultPrefix", event.target.value)
                      }
                      placeholder="shared"
                      value={connectionForm.defaultPrefix}
                    />
                  </label>
                  {provider === "aws-s3" ? (
                    <>
                      <label>
                        Region
                        <input
                          onChange={(event) =>
                            updateConnectionValue("region", event.target.value)
                          }
                          placeholder="us-east-1"
                          required
                          value={connectionForm.region}
                        />
                      </label>
                      <label>
                        Access key ID
                        <input
                          onChange={(event) =>
                            updateConnectionValue(
                              "accessKeyId",
                              event.target.value
                            )
                          }
                          required
                          value={connectionForm.accessKeyId}
                        />
                      </label>
                      <label>
                        Secret access key
                        <input
                          onChange={(event) =>
                            updateConnectionValue(
                              "secretAccessKey",
                              event.target.value
                            )
                          }
                          required
                          type="password"
                          value={connectionForm.secretAccessKey}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="wide-field">
                      Service account JSON
                      <textarea
                        onChange={(event) =>
                          updateConnectionValue(
                            "serviceAccountJSON",
                            event.target.value
                          )
                        }
                        placeholder='{"type":"service_account","project_id":"..."}'
                        required
                        rows={8}
                        value={connectionForm.serviceAccountJSON}
                      />
                    </label>
                  )}
                </div>

                <button
                  className="primary-button"
                  disabled={busyAction === "create-connection"}
                >
                  <Icon name="plus" size={18} />
                  {busyAction === "create-connection" ? "Adding..." : "Add connection"}
                </button>
              </form>

              <section className="tool-panel">
                <div className="panel-title">
                  <div>
                    <span className="eyebrow">Current</span>
                    <h2>Storage map</h2>
                  </div>
                  <Icon name="grid" size={22} />
                </div>

                <div className="connection-cards">
                  {connections.length ? (
                    connections.map((connection) => {
                      const id = itemId(connection);
                      return (
                        <article className="storage-card" key={id}>
                          <div>
                            <span className="connection-icon">
                              <Icon
                                name={
                                  connection.provider === "aws-s3"
                                    ? "database"
                                    : "cloud"
                                }
                                size={19}
                              />
                            </span>
                            <div>
                              <strong>{connection.name}</strong>
                              <small>{providerLabel[connection.provider]}</small>
                            </div>
                          </div>
                          <p>{connection.bucket}</p>
                          <div className="meta-row">
                            <span>{connection.defaultPrefix || "root"}</span>
                            <span>{formatDate(connection.createdAt)}</span>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty-state">
                      <Icon name="cloud" size={28} />
                      <span>No storage connections</span>
                    </div>
                  )}
                </div>
              </section>
            </section>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
