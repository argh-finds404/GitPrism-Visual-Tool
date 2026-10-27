"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { UserProfile } from "@/features/auth/user-auth";
import type { StoredProjectSummary } from "@/features/upload/project-vault";

export function UserIdentityBar({
  user,
  projects,
  currentProjectId,
  onSelectProject,
  onDeleteProject,
  onNewProject,
  onUpdateUser,
}: {
  user: UserProfile;
  projects: StoredProjectSummary[];
  currentProjectId?: string | null;
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onNewProject: () => void;
  onUpdateUser: (updates: Partial<UserProfile>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user.name);
  const [emailInput, setEmailInput] = useState(user.email);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const startEditing = () => {
    setNameInput(user.name);
    setEmailInput(user.email);
    setIsEditing(true);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateUser({ name: nameInput.trim(), email: emailInput.trim() });
      setIsEditing(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] py-1 pl-1.5 pr-2.5 text-[12.5px] transition-colors hover:border-[var(--line-2)] hover:bg-white/[0.04]"
      >
        <span
          className="grid h-6 w-6 place-items-center rounded-full text-[10.5px] font-bold text-white shadow-sm"
          style={{ backgroundColor: user.avatarColor }}
        >
          {initials}
        </span>
        <span className="max-w-[110px] truncate font-medium text-[var(--ink)]">
          {user.name}
        </span>
        {projects.length > 0 && (
          <span className="rounded-full bg-[var(--violet)]/15 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-[var(--violet-ink)]">
            {projects.length}
          </span>
        )}
        <ChevronDown size={13} className="text-[var(--ink-3)]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-[var(--line-2)] bg-[#101014] p-3 shadow-2xl backdrop-blur-xl">
          {/* User Profile Header */}
          <div className="border-b border-[var(--line)] pb-3">
            {!isEditing ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold text-white"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{user.name}</p>
                    <p className="truncate font-mono text-[11px] text-[var(--ink-3)]">{user.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--violet-ink)] hover:bg-[var(--violet)]/10"
                >
                  Edit
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your Name"
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--violet)]"
                />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Your Email"
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--ink)] outline-none focus:border-[var(--violet)]"
                />
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-md px-2 py-0.5 text-[11px] text-[var(--ink-3)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-[var(--violet)] px-2.5 py-0.5 text-[11px] font-medium text-white"
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-[#3DE0A6]">
              <ShieldCheck size={12} />
              <span>Session active • Uncompressed local vault</span>
            </div>
          </div>

          {/* Project List */}
          <div className="mt-3">
            <div className="flex items-center justify-between pb-1.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-3)]">
                Saved Projects ({projects.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNewProject();
                }}
                className="flex items-center gap-1 text-[11px] font-medium text-[var(--violet-ink)] hover:text-white"
              >
                <Plus size={12} /> New
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="py-4 text-center">
                <HardDrive size={22} className="mx-auto text-[var(--ink-3)] opacity-40" />
                <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">No saved projects yet</p>
                <p className="text-[10.5px] text-[var(--ink-3)] opacity-70">
                  Uploaded projects are kept here automatically
                </p>
              </div>
            ) : (
              <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                {projects.map((p) => {
                  const isActive = currentProjectId === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`group flex items-center justify-between rounded-xl border p-2 transition-all ${
                        isActive
                          ? "border-[var(--violet)]/40 bg-[var(--violet)]/10"
                          : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--line-2)] hover:bg-white/[0.04]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onSelectProject(p.id);
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <Folder size={15} className={isActive ? "text-[var(--violet)]" : "text-[var(--ink-3)]"} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-[var(--ink)]">{p.name}</p>
                          <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--ink-3)]">
                            <span>{p.fileCount} files</span>
                            {p.commitCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <GitCommitHorizontal size={10} />
                                {p.commitCount}
                              </span>
                            )}
                            {p.headBranch && (
                              <span className="flex items-center gap-0.5">
                                <GitBranch size={10} />
                                {p.headBranch}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 pl-1">
                        {isActive && <Check size={14} className="text-[var(--violet)]" />}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(p.id);
                          }}
                          className="rounded p-1 text-[var(--ink-3)] opacity-0 transition-opacity hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                          title="Delete saved project"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
