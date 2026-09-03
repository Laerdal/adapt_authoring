import { useState, useMemo, useEffect, useRef } from "react";
import { getUsers, setUserRole, deleteUser } from "@/api/adaptAuthoring";
import AiAssistant from "@/components/common/AiAssistant";

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
  "Super Admin":        "bg-[#fef3c7] text-[#92400e]",
  "Course Creator":     "bg-[#dbeeff] text-[#1e4d73]",
  "Authenticated User": "bg-[#f0fdf4] text-[#166534]",
};

function isValidEmailQuery(value: string): boolean {
  if (value === "") return true;
  return /^[^\s@]+(@[^\s@]*)?$/.test(value);
}

function isCompleteEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function UserManagementPage() {
  const [users, setUsers]             = useState<User[]>([]);

  const loadUsers = () => { getUsers().then(setUsers).catch(() => setUsers([])); };
  useEffect(() => { loadUsers(); }, []);
  const [search, setSearch]           = useState("");
  const [searchError, setSearchError] = useState("");
  const [roleFilter, setRoleFilter]   = useState<Role | "All">("All");
  const [sortKey, setSortKey]         = useState<SortKey>("email");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);
  const [filterOpen, setFilterOpen]   = useState(false);

  // Add user modal state
  const [addOpen, setAddOpen]         = useState(false);
  const [addEmail, setAddEmail]       = useState("");
  const [addRole, setAddRole]         = useState<Role>("Authenticated User");
  const [addTenant, setAddTenant]     = useState(TENANTS[0]);
  const [addEmailErr, setAddEmailErr] = useState("");
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [addTenantOpen, setAddTenantOpen] = useState(false);

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
        setFilterOpen(false);
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
  const paginated  = filtered.slice((page - 1) * pageSize, page * pageSize);

  function openAddModal() {
    setAddEmail("");
    setAddRole("Authenticated User");
    setAddTenant(TENANTS[0]);
    setAddEmailErr("");
    setAddRoleOpen(false);
    setAddTenantOpen(false);
    setAddOpen(true);
  }

  function handleAddEmailChange(value: string) {
    setAddEmail(value);
    if (value.trim() === "") {
      setAddEmailErr("");
    } else if (!isCompleteEmail(value) && value.includes("@")) {
      setAddEmailErr("Enter a valid email address");
    } else if (users.some((u) => u.email.toLowerCase() === value.trim().toLowerCase())) {
      setAddEmailErr("A user with this email already exists");
    } else {
      setAddEmailErr("");
    }
  }

  function submitAddUser() {
    const email = addEmail.trim();
    if (!isCompleteEmail(email)) {
      setAddEmailErr("Enter a valid email address");
      return;
    }
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setAddEmailErr("A user with this email already exists");
      return;
    }
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yy = String(today.getFullYear()).slice(2);
    const newUser: User = {
      id: Math.max(0, ...users.map((u) => u.id)) + 1,
      email,
      tenant: addTenant,
      role: addRole,
      failedLogins: 0,
      lastAccess: `${dd}-${mm}-${yy}`,
    };
    setUsers((prev) => [newUser, ...prev]);
    setPage(1);
    setAddOpen(false);
  }

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
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
    try {
      await setUserRole(target.backendId, target.roleIds ?? [], role);
    } finally {
      loadUsers();
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target?.backendId) return;
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    try {
      await deleteUser(target.backendId);
    } finally {
      loadUsers();
    }
  }

  function handleActionMenu(id: number, action: string) {
    setActionMenuTarget(null);
    if (action === "delete") {
      const user = users.find((u) => u.id === id);
      if (user) setDeleteTarget(user);
    }
    // "transfer", "delete-unshared", "share-all" — handled silently for now (backend ops)
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex flex-col gap-[1px] opacity-50 group-hover:opacity-100">
      <svg width="8" height="5" viewBox="0 0 8 5" fill={sortKey === col && sortDir === "asc" ? "#2d6fa8" : "#9ca3af"}>
        <path d="M4 0L8 5H0L4 0Z" />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill={sortKey === col && sortDir === "desc" ? "#2d6fa8" : "#9ca3af"}>
        <path d="M4 5L0 0H8L4 5Z" />
      </svg>
    </span>
  );

  return (
    <div ref={tableRef} className="flex flex-col h-full">

      {/* ── Page header ── */}
      <div className="px-6 md:px-8 pt-6 pb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#111827] leading-tight">User Management</h1>
          <p className="text-sm text-[#6b7280] mt-1">Manage users, roles, and access for this instance.</p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2d6fa8] hover:bg-[#245c8f] text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add User
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="px-6 md:px-8 pb-1 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            className={`w-full pl-9 ${search ? "pr-8" : "pr-4"} py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent bg-white placeholder-[#9ca3af] text-[#111827] transition-colors ${
              searchError
                ? "border-[#ef4444] focus:ring-[#ef4444]"
                : "border-[#e5e7eb] focus:ring-[#2d6fa8]"
            }`}
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#374151] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Role filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            aria-label="Filter by role"
            aria-expanded={filterOpen}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
              roleFilter !== "All"
                ? "border-[#2d6fa8] bg-[#dbeeff] text-[#2d6fa8] font-medium"
                : "border-[#e5e7eb] bg-white hover:bg-[#f9fafb] text-[#374151]"
            }`}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            {roleFilter === "All" ? "All Roles" : roleFilter}
            {roleFilter !== "All" && (
              <span className="ml-0.5 w-4 h-4 rounded-full bg-[#2d6fa8] text-white text-[10px] font-bold flex items-center justify-center">1</span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${filterOpen ? "rotate-180" : ""}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {filterOpen && (
            <div className="absolute left-0 mt-1 w-52 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-30 py-1">
              <p className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Filter by role</p>
              {(["All", ...ROLES] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRoleFilter(r as Role | "All"); setFilterOpen(false); setPage(1); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${roleFilter === r ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"}`}
                >
                  {r === "All" ? "All Roles" : r}
                  {roleFilter === r && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
              {roleFilter !== "All" && (
                <>
                  <div className="border-t border-[#f3f4f6] my-1" />
                  <button
                    type="button"
                    onClick={() => { setRoleFilter("All"); setFilterOpen(false); setPage(1); }}
                    className="w-full text-left px-3 py-2 text-sm text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
                  >
                    Clear filter
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {(search || roleFilter !== "All") && (
          <div className="flex items-center gap-2 flex-wrap">
            {search && !searchError && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f3f4f6] text-xs text-[#374151] font-medium">
                Email: <span className="text-[#2d6fa8]">"{search}"</span>
                <button type="button" onClick={clearSearch} aria-label="Remove email filter" className="text-[#9ca3af] hover:text-[#374151] ml-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            )}
            {roleFilter !== "All" && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#dbeeff] text-xs text-[#2d6fa8] font-medium">
                Role: {roleFilter}
                <button type="button" onClick={() => { setRoleFilter("All"); setPage(1); }} aria-label="Remove role filter" className="text-[#2d6fa8] hover:text-[#1e4d73] ml-0.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() => { clearSearch(); setRoleFilter("All"); setPage(1); }}
              className="text-xs text-[#9ca3af] hover:text-[#374151] underline underline-offset-2 transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

      </div>

      {/* Search validation error */}
      {searchError && (
        <div className="px-6 md:px-8 pb-3">
          <p id="search-error" role="alert" className="text-xs text-[#ef4444] flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {searchError}
          </p>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 px-6 md:px-8 pb-4">
        <div className="rounded-xl border border-[#e5e7eb] overflow-hidden bg-white">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#f9fafb] border-b border-[#e5e7eb]">
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
                    onClick={() => handleSort(key)}
                    className="group px-4 py-3 text-left text-xs font-semibold text-[#374151] uppercase tracking-wide cursor-pointer select-none whitespace-nowrap hover:text-[#2d6fa8] transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      <SortIcon col={key} />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#374151] uppercase tracking-wide whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-[#9ca3af]">No users found</td>
                </tr>
              ) : paginated.map((user) => (
                <tr key={user.id} className="border-b border-[#f3f4f6] hover:bg-[#fafafa] transition-colors group/row">
                  {/* Email */}
                  <td className="px-4 py-3 text-[#111827] font-medium">{user.email}</td>

                  {/* Tenant */}
                  <td className="px-4 py-3 text-[#6b7280]">{user.tenant}</td>

                  {/* Role — click to change */}
                  <td className="px-4 py-3 relative">
                    <button
                      type="button"
                      onClick={() => setRoleMenuTarget(roleMenuTarget === user.id ? null : user.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[user.role]} hover:opacity-80 transition-opacity`}
                    >
                      {user.role}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {roleMenuTarget === user.id && (
                      <div className="absolute left-3 top-full mt-1 w-44 bg-white border border-[#e5e7eb] rounded-lg shadow-xl z-30 py-1">
                        <p className="px-3 py-1.5 text-xs font-semibold text-[#9ca3af] uppercase tracking-wide">Change role</p>
                        {ROLES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => changeRole(user.id, r)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${user.role === r ? "text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"}`}
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
                  <td className="px-4 py-3">
                    <span className={`font-medium ${user.failedLogins >= 5 ? "text-[#ef4444]" : user.failedLogins >= 1 ? "text-[#f59e0b]" : "text-[#6b7280]"}`}>
                      {user.failedLogins}
                    </span>
                  </td>

                  {/* Last access */}
                  <td className="px-4 py-3 text-[#6b7280] tabular-nums">{user.lastAccess}</td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 relative">
                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(user)}
                        title="Delete user"
                        className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#ef4444] hover:bg-[#fef2f2] transition-colors"
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
                        className="p-1.5 rounded-lg text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] transition-colors"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
                        </svg>
                      </button>

                      {actionMenuTarget === user.id && (
                        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-[#e5e7eb] rounded-lg shadow-xl z-30 py-1">
                          <button
                            type="button"
                            onClick={() => handleActionMenu(user.id, "transfer")}
                            className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb] flex items-center gap-2.5"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 3h5v5M8 21H3v-5" /><path d="M21 3l-7 7M3 21l7-7" />
                            </svg>
                            Transfer ownership to me
                          </button>
                          <button
                            type="button"
                            onClick={() => handleActionMenu(user.id, "delete-unshared")}
                            className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb] flex items-center gap-2.5"
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
                            className="w-full text-left px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb] flex items-center gap-2.5"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                            Share all courses
                          </button>
                          <div className="border-t border-[#f3f4f6] my-1" />
                          <button
                            type="button"
                            onClick={() => handleActionMenu(user.id, "delete")}
                            className="w-full text-left px-3 py-2 text-sm text-[#ef4444] hover:bg-[#fef2f2] flex items-center gap-2.5"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            </svg>
                            Delete user
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── Table footer / pagination ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#e5e7eb] bg-[#f9fafb]">
            {/* Row count + page size */}
            <div className="flex items-center gap-3 text-sm text-[#6b7280]">
              <span>
                {filtered.length === 0
                  ? "0 results"
                  : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} of ${filtered.length} user${filtered.length !== 1 ? "s" : ""}`}
              </span>
              <span className="text-[#d1d5db]">|</span>
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="text-sm border border-[#e5e7eb] rounded-md px-2 py-1 text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] bg-white"
                title="Rows per page"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page === 1}
                title="First page"
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                title="Previous page"
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-[#9ca3af] text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p as number)}
                      className={`min-w-[30px] h-[30px] rounded-lg text-sm font-medium transition-colors ${page === p ? "bg-[#2d6fa8] text-white" : "text-[#374151] hover:bg-[#e5e7eb]"}`}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                title="Next page"
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                title="Last page"
                className="p-1.5 rounded-lg text-[#6b7280] hover:bg-[#e5e7eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <AiAssistant context="User Management" />

      {/* ── Add User modal ── */}
      {addOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb]">
              <div>
                <h2 className="font-semibold text-[#111827] text-base">Add User</h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Invite a new user to this instance</p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-[#f3f4f6] text-[#6b7280] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  Email Address <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => handleAddEmailChange(e.target.value)}
                  placeholder="e.g. user@laerdal.com"
                  autoFocus
                  aria-invalid={!!addEmailErr}
                  aria-describedby={addEmailErr ? "add-email-error" : undefined}
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent text-[#111827] placeholder-[#9ca3af] transition-colors ${
                    addEmailErr
                      ? "border-[#ef4444] focus:ring-[#ef4444]"
                      : "border-[#d1d5db] focus:ring-[#2d6fa8]"
                  }`}
                />
                {addEmailErr && (
                  <p id="add-email-error" role="alert" className="mt-1.5 text-xs text-[#ef4444] flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {addEmailErr}
                  </p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Role</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setAddRoleOpen((o) => !o); setAddTenantOpen(false); }}
                    aria-expanded={addRoleOpen}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg bg-white hover:border-[#2d6fa8] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] text-[#111827] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[addRole]}`}>{addRole}</span>
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${addRoleOpen ? "rotate-180" : ""}`}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {addRoleOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-10 py-1">
                      {ROLES.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => { setAddRole(r); setAddRoleOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${addRole === r ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"}`}
                        >
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[r]}`}>{r}</span>
                          {addRole === r && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tenant */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Tenant</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setAddTenantOpen((o) => !o); setAddRoleOpen(false); }}
                    aria-expanded={addTenantOpen}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm border border-[#d1d5db] rounded-lg bg-white hover:border-[#2d6fa8] focus:outline-none focus:ring-2 focus:ring-[#2d6fa8] text-[#111827] transition-colors"
                  >
                    <span>{addTenant}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${addTenantOpen ? "rotate-180" : ""}`}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {addTenantOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e5e7eb] rounded-lg shadow-lg z-10 py-1">
                      {TENANTS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setAddTenant(t); setAddTenantOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${addTenant === t ? "bg-[#dbeeff] text-[#2d6fa8] font-medium" : "text-[#374151] hover:bg-[#f9fafb]"}`}
                        >
                          {t}
                          {addTenant === t && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddUser}
                disabled={!addEmail.trim() || !!addEmailErr}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#2d6fa8] hover:bg-[#245c8f] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                </svg>
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fef2f2] flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-[#111827] text-base">Delete User</h2>
                  <p className="text-sm text-[#6b7280] mt-1">
                    You are about to delete <span className="font-medium text-[#111827]">{deleteTarget.email}</span>.
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 pb-5 flex flex-col gap-3">
              <div className="p-4 rounded-lg bg-[#fef3c7] border border-[#fde68a]">
                <p className="text-sm font-semibold text-[#92400e]">
                  Ownership of this user's courses will be transferred to you.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-[#fef2f2] border border-[#fecaca]">
                <p className="text-sm text-[#b91c1c]">
                  ⚠ This action cannot be reverted. The user will be permanently removed.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#e5e7eb]">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#d1d5db] rounded-lg hover:bg-[#f9fafb] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#ef4444] hover:bg-[#dc2626] rounded-lg transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
