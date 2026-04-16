"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, PencilLine, Plus, Trash2, Upload } from "lucide-react";

import { usersApi } from "../../../api/usersApi";
import AdminRoute from "../../../components/AdminRoute";
import EmptyState from "../../../components/ui/EmptyState";
import ErrorState from "../../../components/ui/ErrorState";
import LoadingState from "../../../components/ui/LoadingState";
import ModalShell from "../../../components/ui/ModalShell";

interface ManagedUser {
  id: string;
  fullName: string;
  studentId: string;
  avatar?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserFormState {
  fullName: string;
  studentId: string;
}

const emptyForm: UserFormState = {
  fullName: "",
  studentId: "",
};

function normalizeUser(user: unknown): ManagedUser {
  const item = user as Record<string, unknown>;
  return {
    id: String(item.id ?? item._id ?? ""),
    fullName: String(item.fullName || ""),
    studentId: String(item.studentId || ""),
    avatar: item.avatar ? String(item.avatar) : undefined,
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  };
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("lo-LA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeImportRow(row: Record<string, unknown>) {
  return {
    fullName: String(row.fullName ?? row.name ?? "").trim(),
    studentId: String(row.studentId ?? "").trim(),
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 10;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const res = await usersApi.getAll();
      const mapped = Array.isArray(res.data) ? res.data.map(normalizeUser) : [];
      setUsers(mapped);
      setSelectedUserIds((prev) =>
        prev.filter((id) => mapped.some((item) => item.id === id)),
      );
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setPageError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "Failed to load voters",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(query) ||
        user.studentId.toLowerCase().includes(query),
    );
  }, [search, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, safeCurrentPage]);

  const paginatedUserIds = useMemo(
    () => paginatedUsers.map((user) => user.id),
    [paginatedUsers],
  );

  const selectedOnPageCount = useMemo(
    () => paginatedUserIds.filter((id) => selectedUserIds.includes(id)).length,
    [paginatedUserIds, selectedUserIds],
  );

  const allPageSelected =
    paginatedUsers.length > 0 && selectedOnPageCount === paginatedUsers.length;

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedOnPageCount > 0 && !allPageSelected;
  }, [selectedOnPageCount, allPageSelected]);

  const stats = useMemo(
    () => ({
      total: users.length,
      filtered: filteredUsers.length,
      selected: selectedUserIds.length,
    }),
    [users.length, filteredUsers.length, selectedUserIds.length],
  );

  const resetForm = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setFormError("");
    setIsModalOpen(false);
  };

  const handleDownloadUsers = () => {
    const escapeCsvValue = (value: string) =>
      `"${String(value || "").replace(/"/g, '""')}"`;
    const csv = [
      "fullName,studentId",
      ...users.map((user) =>
        [
          escapeCsvValue(user.fullName),
          escapeCsvValue(user.studentId),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "voters-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportError("");
    setImportMessage("");
    setImporting(true);

    try {
      const { default: Papa } = await import("papaparse");
      const parsed = await new Promise<{ data: Record<string, unknown>[] }>(
        (resolve, reject) => {
          Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) =>
              resolve({
                data: (result.data || []) as Record<string, unknown>[],
              }),
            error: (parseError) => reject(parseError),
          });
        },
      );

      const rows = parsed.data
        .map(normalizeImportRow)
        .filter((row) => row.fullName || row.studentId);

      if (rows.length === 0) {
        setImportError("CSV does not contain any importable rows.");
        return;
      }

      const res = await usersApi.importCsv(rows);
      const created = Array.isArray(res.data?.created)
        ? res.data.created.map(normalizeUser)
        : [];
      const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped : [];

      if (created.length > 0) {
        setUsers((prev) => [...created, ...prev]);
        setCurrentPage(1);
      }

      setImportMessage(
        `Imported ${created.length} row(s)${
          skipped.length > 0 ? `, skipped ${skipped.length}` : ""
        }.`,
      );
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setImportError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "CSV import failed",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!form.fullName.trim() || !form.studentId.trim()) {
      setFormError("Full name and student ID are required.");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const res = await usersApi.update(editingUser.id, {
          fullName: form.fullName.trim(),
          studentId: form.studentId.trim(),
        });
        const updated = normalizeUser(res.data);
        setUsers((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const res = await usersApi.create({
          fullName: form.fullName.trim(),
          studentId: form.studentId.trim(),
        });
        const created = normalizeUser(res.data);
        setUsers((prev) => [created, ...prev]);
        setCurrentPage(1);
      }

      resetForm();
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setFormError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "Failed to save voter",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      studentId: user.studentId,
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleDelete = async (user: ManagedUser) => {
    const label = user.fullName || user.studentId;
    const confirmed = window.confirm(`Delete voter "${label}"?`);
    if (!confirmed) return;

    setDeletingId(user.id);
    setPageError("");
    try {
      await usersApi.delete(user.id);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setSelectedUserIds((prev) => prev.filter((id) => id !== user.id));
      if (editingUser?.id === user.id) {
        resetForm();
      }
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setPageError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "Failed to delete voter",
      );
    } finally {
      setDeletingId("");
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const toggleSelectAllOnPage = () => {
    if (allPageSelected) {
      setSelectedUserIds((prev) =>
        prev.filter((id) => !paginatedUserIds.includes(id)),
      );
      return;
    }

    setSelectedUserIds((prev) =>
      Array.from(new Set([...prev, ...paginatedUserIds])),
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedUserIds.length === 0) return;

    const selectedUsers = users.filter((user) =>
      selectedUserIds.includes(user.id),
    );
    const confirmed = window.confirm(
      `Delete ${selectedUsers.length} selected voter(s)?`,
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    setPageError("");

    const results = await Promise.allSettled(
      selectedUsers.map(async (user) => {
        await usersApi.delete(user.id);
        return user;
      }),
    );

    const deletedIds: string[] = [];
    const failedUsers: string[] = [];

    results.forEach((result, index) => {
      const user = selectedUsers[index];
      if (result.status === "fulfilled") {
        deletedIds.push(user.id);
      } else {
        failedUsers.push(user.fullName || user.studentId);
      }
    });

    if (deletedIds.length > 0) {
      setUsers((prev) => prev.filter((user) => !deletedIds.includes(user.id)));
      setSelectedUserIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );
      if (editingUser && deletedIds.includes(editingUser.id)) {
        resetForm();
      }
    }

    if (failedUsers.length > 0) {
      setPageError(`Delete failed for: ${failedUsers.join(", ")}`);
    }

    setBulkDeleting(false);
  };

  return (
    <AdminRoute>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Manage Voters
              </h1>
              <p className="text-sm text-slate-500">
                Voters now use only full name and student ID.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              Create voter
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Import from CSV
                </p>
                <p className="text-xs text-slate-500">
                  Supported columns: `fullName`, `studentId`
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadUsers}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Export voters CSV
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <Upload className="h-4 w-4" />
                  Choose CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>
            </div>

            {importError ? (
              <p className="mt-3 text-sm text-rose-600">{importError}</p>
            ) : null}
            {importMessage ? (
              <p className="mt-3 text-sm text-emerald-600">{importMessage}</p>
            ) : null}
            {importing ? (
              <p className="mt-3 text-xs text-slate-500">Importing CSV...</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Total voters</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {stats.total}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Filtered</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {stats.filtered}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">Selected</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {stats.selected}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by full name or student ID"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              />
            </div>

            {selectedUserIds.length > 0 ? (
              <div className="flex items-center justify-between border-b border-slate-200 bg-rose-50 px-4 py-3">
                <span className="text-sm text-slate-700">
                  {selectedUserIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteSelected()}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {bulkDeleting ? "Deleting..." : "Delete selected"}
                </button>
              </div>
            ) : null}

            {loading ? <LoadingState label="Loading voters..." /> : null}

            {!loading && pageError ? (
              <div className="p-4">
                <ErrorState
                  title="Failed to load voters"
                  description={pageError}
                  action={
                    <button
                      type="button"
                      onClick={() => void fetchUsers()}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                      Retry
                    </button>
                  }
                />
              </div>
            ) : null}

            {!loading && !pageError && filteredUsers.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No voters yet"
                  description="Create a voter or import them from CSV."
                />
              </div>
            ) : null}

            {!loading && !pageError && filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <input
                          type="checkbox"
                          ref={selectAllRef}
                          checked={allPageSelected}
                          onChange={toggleSelectAllOnPage}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Full name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Student ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-slate-900">
                          {user.fullName}
                        </td>
                        <td className="px-4 py-4 font-mono text-sm text-slate-600">
                          {user.studentId}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(user)}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50"
                              title="Edit"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(user)}
                              disabled={deletingId === user.id}
                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white p-2 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 ? (
                  <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                    <div className="text-sm text-slate-700">
                      Showing {(safeCurrentPage - 1) * pageSize + 1}-
                      {Math.min(safeCurrentPage * pageSize, filteredUsers.length)} of{" "}
                      {filteredUsers.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={safeCurrentPage === 1}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-500">
                        Page {safeCurrentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={safeCurrentPage === totalPages}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ModalShell
        open={isModalOpen}
        onClose={resetForm}
        title={editingUser ? "Edit voter" : "Create voter"}
        description="Voters use full name and student ID only."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Full name
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  fullName: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              placeholder="Somsack Sivilay"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Student ID
            </label>
            <input
              type="text"
              value={form.studentId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  studentId: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              placeholder="20230001"
            />
          </div>

          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving
                ? "Saving..."
                : editingUser
                  ? "Save changes"
                  : "Create voter"}
            </button>
          </div>
        </form>
      </ModalShell>
    </AdminRoute>
  );
}
