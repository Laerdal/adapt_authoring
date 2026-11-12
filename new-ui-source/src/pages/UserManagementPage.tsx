import { useState, useMemo, useEffect, useRef } from "react";
import { getUsers, setUserRole, deleteUser, disableUser, restoreUser } from "@/api/adaptAuthoring";
import { usePageLoader } from "@/hooks";
import { useAuth } from "@/context/AuthContext";
import AiAssistant from "@/components/common/AiAssistant";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import ErrorDialog from "@/components/common/ErrorDialog";
import Paginator from "@/components/common/Paginator";

type Role = "Super Admin" | "Authenticated User" | "Course Creator";

interface User {
  id: number;
  backendId?: string;   // engine _id — used for role change / delete
  roleIds?: string[];   // engine role ids — needed to reassign roles
  email: string;
  tenant: string;
  role: Role;
  failedLogins: number;
  lastAccess: string; // DD-MM-YY
  isDeleted?: boolean;
}

const INITIAL_USERS: User[] = [
  { id: 1, email: "alice.johnson@laerdal.com",   tenant: "master", role: "Super Admin",        failedLogins: 0,  lastAccess: "24-06-26" },
  { id: 2, email: "bob.smith@laerdal.com",        tenant: "master", role: "Course Creator",     failedLogins: 2,  lastAccess: "23-06-26" },
  { id: 3, email: "carol.white@laerdal.com",      tenant: "master", role: "Authenticated User", failedLogins: 0,  lastAccess: "22-06-26" },
  { id: 4, email: "david.brown@laerdal.com",      tenant: "master", role: "Course Creator",     failedLogins: 5,  lastAccess: "20-06-26" },
  { id: 5, email: "eva.martinez@laerdal.com",     tenant: "master", role: "Authenticated User", failedLogins: 1,  lastAccess: "19-06-26" },
  { id: 6, email: "frank.lee@laerdal.com",        tenant: "master", role: "Course Creator",     failedLogins: 0,  lastAccess: "18-06-26" },
  { id: 7, email: "grace.kim@laerdal.com",        tenant: "master", role: "Super Admin",        failedLogins: 0,  lastAccess: "17-06-26" },
  { id: 8, email: "henry.chen@laerdal.com",       tenant: "master", role: "Authenticated User", failedLogins: 3,  lastAccess: "15-06-26" },
  { id: 9, email: "iris.taylor@laerdal.com",      tenant: "master", role: "Course Creator",     failedLogins: 0,  lastAccess: "14-06-26" },
  { id: 10, email: "james.wilson@laerdal.com",    tenant: "master", role: "Authenticated User", failedLogins: 7,  lastAccess: "10-06-26" },
  { id: 11, email: "kate.anderson@laerdal.com",   tenant: "master", role: "Course Creator",     failedLogins: 0,  lastAccess: "08-06-26" },
  { id: 12, email: "liam.thomas@laerdal.com",     tenant: "master", role: "Authenticated User", failedLogins: 1,  lastAccess: "05-06-26" },
];

const ROLES: Role[] = ["Super Admin", "Authenticated User", "Course Creator"];
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const TENANTS = ["master", "laerdal-us", "laerdal-eu", "laerdal-apac"];

type SortKey = keyof User;
type SortDir = "asc" | "desc";

const ROLE_COLORS: Record<Role, string> = {
  "Super Admin":        "life-dropdown-btn--warning life-badge--warning",
  "Course Creator":     "life-dropdown-btn--primary life-badge--primary",
  "Authenticated User": "life-dropdown-btn--positive life-badge--positive",
};

function isValidEmailQuery(value: string): boolean {
  if (value === "") return true;
  return /^[^\s@]+(@[^\s@]*)?$/.test(value);
}

function isCompleteEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getUserActionLabel(isDeleted: boolean): string {
  return isDeleted ? "Restore user" : "Disable user";
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers]             = useState<User[]>([]);
  const [loading, setLoading]         = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  usePageLoader(loading);

  const loadUsers = () => {
    setLoading(true);
    getUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };
  useEffect(() => { loadUsers(); }, []);
  const [search, setSearch]           = useState("");
  const [searchError, setSearchError] = useState("");
  const [roleFilter, setRoleFilter]   = useState<Role | "All">("All");
  const [sortKey, setSortKey]         = useState<SortKey>("email");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);

  // Row-action state
  const [deleteTarget, setDeleteTarget]         = useState<User | null>(null);
  const [roleMenuTarget, setRoleMenuTarget]     = useState<number | null>(null);
  const [actionMenuTarget, setActionMenuTarget] = useState<number | null>(null);

  // Close all dropdowns on outside click (no blocking overlay)
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setRoleMenuTarget(null);
        setActionMenuTarget(null);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  function handleSearchChange(value: string) {
    if (!isValidEmailQuery(value)) {
      setSearchError("Enter a valid email address (no spaces or special characters)");
    } else {
      setSearchError("");
    }
    setSearch(value);
    setPage(1);
  }

  function clearSearch() {
    setSearch("");
    setSearchError("");
    setPage(1);
  }

  /* ── Filtering + Sorting + Pagination ── */
  const filtered = useMemo(() => {
    const trimmed = search.trim().toLowerCase();
    let list = users.filter((u) => {
      const matchSearch = trimmed === "" || u.email.toLowerCase().includes(trimmed);
      const matchRole   = roleFilter === "All" || u.role === roleFilter;
      return matchSearch && matchRole;
    });

    list = [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [users, search, roleFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  async function changeRole(id: number, role: Role) {
    const target = users.find((u) => u.id === id);
    setRoleMenuTarget(null);
    if (!target?.backendId) return;
    // optimistic update, then persist + reload from the engine
    setActionError(null);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
    try {
      await setUserRole(target.backendId, target.roleIds ?? [], role);
    } catch {
      setActionError(`Failed to change the role for ${target.email}. Please try again.`);
    } finally {
      loadUsers();
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target?.backendId) return;
    setActionError(null);
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    try {
      await deleteUser(target.backendId);
    } catch {
      setActionError(`Failed to delete ${target.email}. Please try again.`);
    } finally {
      loadUsers();
    }
  }

  async function toggleUserDisabledState(id: number) {
    const target = users.find((u) => u.id === id);
    setActionMenuTarget(null);
    if (!target?.backendId) return;

    const nextState = !target.isDeleted;
    setActionError(null);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, isDeleted: nextState } : u));

    try {
      if (nextState) {
        await disableUser(target.backendId);
      } else {
        await restoreUser(target.backendId);
      }
    } catch {
      setActionError(`Failed to ${nextState ? "disable" : "restore"} ${target.email}. Please try again.`);
    } finally {
      loadUsers();
    }
  }

  function handleActionMenu(id: number, action: string) {
    setActionMenuTarget(null);
    if (action === "delete") {
      const user = users.find((u) => u.id === id);
      if (user) setDeleteTarget(user);
      return;
    }
    if (action === "disable-user" || action === "restore-user") {
      void toggleUserDisabledState(id);
      return;
    }
    // "transfer", "delete-unshared", "share-all" — handled silently for now (backend ops)
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex flex-col gap-[1px] opacity-50 group-hover:opacity-100">
      <svg width="8" height="5" viewBox="0 0 8 5" fill={sortKey === col && sortDir === "asc" ? "var(--life-primary-500)" : "var(--life-neutral-400)"}>
        <path d="M4 0L8 5H0L4 0Z" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill={sortKey === col && sortDir === "desc" ? "var(--life-primary-500)" : "var(--life-neutral-400)"}>
        <path d="M4 5L0 0H8L4 5Z" />
      </svg>
    </span>
  );

  return (
    <div ref={tableRef} className="flex flex-col h-full">

      {/* ── Page header ── */}
      <div className="px-6 md:px-8 pt-6 pb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--life-neutral-850)] leading-tight">User Management</h1>
          <p className="text-sm text-[var(--life-neutral-600)] mt-1">Manage users, roles, and access for this instance</p>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="px-6 md:px-8 pb-1 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--life-neutral-400)]" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") clearSearch(); }}
            placeholder="Search by email…"
            aria-label="Search users by email"
            aria-invalid={!!searchError}
            aria-describedby={searchError ? "search-error" : undefined}
            className={`life-field pl-9 ${search ? "pr-8" : "pr-4"}`}
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--life-neutral-500)] hover:text-[var(--life-neutral-850)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Role filter */}
        <div role="tablist" aria-label="Filter by role" className="life-tabs">
          {(["All", ...ROLES] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={roleFilter === option}
              onClick={() => {
                setRoleFilter(option);
                setPage(1);
              }}
              className="life-tab"
            >
              {option}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {search && !searchError && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="life-chip life-chip--neutral">
              Email: <span className="text-[var(--life-primary-600)]">"{search}"</span>
              <button type="button" onClick={clearSearch} aria-label="Remove email filter" className="text-[var(--life-neutral-500)] hover:text-[var(--life-neutral-850)] ml-0.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          </div>
        )}

      </div>

      {/* Search validation error */}
      {searchError && (
        <div className="px-6 md:px-8 pb-3">
          <p id="search-error" role="alert" className="text-xs text-[var(--life-color-text-critical)] flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {searchError}
          </p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 px-6 md:px-8 pb-4">
        <div className="life-table-wrap life-table-wrap--visible">
          <table className="life-table min-w-[700px]">
            <thead>
              <tr>
                {(
                  [
                    { key: "email",        label: "Email Address" },
                    { key: "tenant",       label: "Tenant" },
                    { key: "role",         label: "Role" },
                    { key: "failedLogins", label: "Failed Login" },
                    { key: "lastAccess",   label: "Last Access" },
                  ] as { key: SortKey; label: string }[]
                ).map(({ key, label }) => (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                    onClick={() => handleSort(key)}
                    className={`group life-th-sortable ${key === "email" ? "!text-left" : "!text-center"}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${key === "email" ? "" : "justify-center w-full"}`}>
                      {label}
                      <SortIcon col={key} />
                    </span>
                  </th>
                ))}
                <th scope="col" className="!text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="life-table-empty">No users found</td>
                </tr>
              ) : paginated.map((user) => {
                const isCurrentUser = user.email.toLowerCase() === currentUser?.email.toLowerCase();
                const isUserDisabled = !!user.isDeleted;

                return (
                <tr key={user.id} className={`group/row ${isCurrentUser ? "font-bold" : ""}`}>
                  {/* Email */}
                  <td className={`${isCurrentUser ? "font-bold" : "font-normal"} ${isUserDisabled ? "opacity-60 grayscale-[0.25] saturate-50" : ""}`}>{user.email}</td>

                  {/* Tenant */}
                  <td className={`text-center ${isCurrentUser ? "font-bold" : "text-[var(--life-neutral-600)]"} ${isUserDisabled ? "opacity-60 grayscale-[0.25] saturate-50" : ""}`}>{user.tenant}</td>

                  {/* Role — click to change */}
                  <td className={`text-center relative ${isUserDisabled ? "opacity-60 grayscale-[0.25] saturate-50" : ""}`}>
                    {isCurrentUser || isUserDisabled ? (
                      <span className={`life-badge ${ROLE_COLORS[user.role]}`}>
                        {user.role}
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={roleMenuTarget === user.id}
                        onClick={() => setRoleMenuTarget(roleMenuTarget === user.id ? null : user.id)}
                        className={`life-dropdown-btn ${ROLE_COLORS[user.role]}`}
                      >
                        {user.role}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    )}
                    {!isCurrentUser && !isUserDisabled && roleMenuTarget === user.id && (
                      <div role="menu" className="life-menu absolute left-3 top-full mt-1 w-48 z-30 text-left">
                        <p className="life-menu-heading">Change role</p>
                        {ROLES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            role="menuitemradio"
                            aria-checked={user.role === r}
                            aria-selected={user.role === r}
                            onClick={() => changeRole(user.id, r)}
                            className="life-menu-item justify-between"
                          >
                            {r}
                            {user.role === r && (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Failed logins */}
                  <td className={`text-center ${isUserDisabled ? "opacity-60 grayscale-[0.25] saturate-50" : ""}`}>
                    <span className={`${isCurrentUser ? "font-bold" : `font-medium ${user.failedLogins >= 5 ? "text-[var(--life-critical-600)]" : user.failedLogins >= 1 ? "text-[var(--life-warning-500)]" : "text-[var(--life-neutral-600)]"}`}`}>
                      {user.failedLogins}
                    </span>
                  </td>

                  {/* Last access */}
                  <td className={`text-center tabular-nums ${isCurrentUser ? "font-bold" : "text-[var(--life-neutral-600)]"} ${isUserDisabled ? "opacity-60 grayscale-[0.25] saturate-50" : ""}`}>{user.lastAccess}</td>

                  {/* Actions */}
                  <td className="text-center">
                    {isCurrentUser ? (
                      <span className="block text-center text-xs font-bold leading-snug w-40 mx-auto">Please log in as another admin for full access.</span>
                    ) : (
                    <div className="flex items-center justify-center gap-1 relative">
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        title="Delete user"
                        aria-label={`Delete ${user.email}`}
                        className="life-icon-btn life-icon-btn--sm life-icon-btn--critical"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      </button>

                      {/* More actions */}
                      <button
                        type="button"
                        onClick={() => setActionMenuTarget(actionMenuTarget === user.id ? null : user.id)}
                        title="More actions"
                        aria-label={`More actions for ${user.email}`}
                        aria-haspopup="menu"
                        aria-expanded={actionMenuTarget === user.id}
                        className="life-icon-btn life-icon-btn--sm"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>

                      {actionMenuTarget === user.id && (
                        <div role="menu" className="life-menu absolute right-0 top-full mt-1 w-56 z-30 text-left">
                          <button
                            type="button"
                            onClick={() => handleActionMenu(user.id, user.isDeleted ? "restore-user" : "disable-user")}
                            role="menuitem"
                            className="life-menu-item"
                          >
                            <img
                              src={user.isDeleted ? "/assets/icons/UserRow.svg" : "/assets/icons/DisableUserIcon.svg"}
                              alt=""
                              className="w-4 h-4 shrink-0"
                            />
                            {getUserActionLabel(!!user.isDeleted)}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleActionMenu(user.id, "transfer")}
                            role="menuitem"
                            className="life-menu-item"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 3h5v5M8 21H3v-5" /><path d="M21 3l-7 7M3 21l7-7" />
                            </svg>
                            Transfer ownership to me
                          </button>
                          <button
                            type="button"
                            onClick={() => handleActionMenu(user.id, "delete-unshared")}
                            role="menuitem"
                            className="life-menu-item"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                              <line x1="18" y1="6" x2="6" y2="18" />
                            </svg>
                            Delete all unshared courses
                          </button>
                          <button
                            type="button"
                            onClick={() => handleActionMenu(user.id, "share-all")}
                            role="menuitem"
                            className="life-menu-item"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                            Share all courses
                          </button>
                        </div>
                      )}
                    </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          <Paginator
            page={safePage}
            pageSize={pageSize}
            totalItems={filtered.length}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            itemLabel="user"
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
        </div>
      </div>

      <AiAssistant context="User Management" />

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <ConfirmDialog
          open
          title="Delete User"
          message="Are you sure you want to delete this user?"
          note={<>Ownership of this user's courses will be transferred to you. This action cannot be reverted. The user will be permanently removed.</>}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      <ErrorDialog
        open={Boolean(actionError)}
        title="User action failed"
        message={actionError ?? "The requested user action could not be completed."}
        onClose={() => setActionError(null)}
      />

    </div>
  );
}
