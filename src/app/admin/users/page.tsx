"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Download, PencilLine, Plus, Trash2, Upload, X } from "lucide-react";

import AdminRoute from "../../../components/AdminRoute";
import EmptyState from "../../../components/ui/EmptyState";
import ErrorState from "../../../components/ui/ErrorState";
import LoadingState from "../../../components/ui/LoadingState";
import ModalShell from "../../../components/ui/ModalShell";
import { usersApi } from "../../../api/usersApi";

interface ManagedUser {
  id: string;
  username: string;
  fullName: string;
  studentId: string;
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const emptyForm = {
  username: "",
  fullName: "",
  studentId: "",
};

function normalizeUser(user: unknown): ManagedUser {
  const item = user as Record<string, unknown>;
  return {
    id: String(item.id ?? item._id ?? ""),
    username: String(item.username || ""),
    fullName: String(item.fullName || ""),
    studentId: String(item.studentId || ""),
    mustChangePassword: Boolean(item.mustChangePassword),
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? String(item.updatedAt) : undefined,
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [resetPasswordToStudentId, setResetPasswordToStudentId] =
    useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // Có thể để configurable sau
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await usersApi.getAll();
      const mapped = Array.isArray(res.data) ? res.data.map(normalizeUser) : [];
      setUsers(mapped);
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບໍ່ສາມາດໂຫຼດຜູ້ໃຊ້ໄດ້",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (user) =>
        user.username.toLowerCase().includes(q) ||
        user.fullName.toLowerCase().includes(q) ||
        user.studentId.toLowerCase().includes(q),
    );
  }, [search, users]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredUsers.slice(startIndex, endIndex);
  }, [filteredUsers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  const paginatedUserIds = useMemo(
    () => paginatedUsers.map((user) => user.id),
    [paginatedUsers],
  );
  const selectedFilteredCount = useMemo(
    () => paginatedUserIds.filter((id) => selectedUserIds.includes(id)).length,
    [paginatedUserIds, selectedUserIds],
  );
  const allFilteredSelected =
    paginatedUsers.length > 0 &&
    selectedFilteredCount === paginatedUsers.length;

  const resetForm = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setResetPasswordToStudentId(false);
    setError("");
    setIsModalOpen(false);
  };

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when search changes
  }, [search]);

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate =
      selectedFilteredCount > 0 && !allFilteredSelected;
  }, [selectedFilteredCount, allFilteredSelected]);

  const handleDownloadSample = () => {
    const csv = [
      "username,fullName,studentId",
      "student01,Somsack Sivilay,20230001",
      "student02,Khamla Vong,20230002",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "users-sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const normalizeImportRow = (row: Record<string, unknown>) => ({
    username: String(row.username ?? "").trim(),
    fullName: String(row.fullName ?? row.name ?? "").trim(),
    studentId: String(row.studentId ?? "").trim(),
  });

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
      const parsed = await new Promise<{ data: Record<string, unknown>[] }>(
        (resolve, reject) => {
          Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) =>
              resolve({
                data: (result.data || []) as Record<string, unknown>[],
              }),
            error: (error) => reject(error),
          });
        },
      );

      const rows = (parsed.data || [])
        .map(normalizeImportRow)
        .filter((row) => row.username || row.fullName || row.studentId);

      if (rows.length === 0) {
        setImportError("CSV ບໍ່ມີຂໍ້ມູນທີ່ນຳເຂົ້າໄດ້");
        return;
      }

      const res = await usersApi.importCsv(rows);
      const created = Array.isArray(res.data?.created)
        ? res.data.created.map(normalizeUser)
        : [];
      const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped : [];

      if (created.length > 0) {
        setUsers((prev) => [...created, ...prev]);
        setCurrentPage(1); // Reset to first page when new users are added
      }

      const createdCount = created.length;
      const skippedCount = skipped.length;
      setImportMessage(
        `ນຳເຂົ້າສຳເລັດ ${createdCount} ລາຍການ${skippedCount > 0 ? `, ຂ້າມ ${skippedCount} ລາຍການ` : ""}`,
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
          : message || typedErr?.message || "ນຳເຂົ້າ CSV ບໍ່ສຳເລັດ",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (
      !form.username.trim() ||
      !form.fullName.trim() ||
      !form.studentId.trim()
    ) {
      setError("ກະລຸນາປ້ອນ username, name ແລະ student ID ໃຫ້ຄົບ");
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const res = await usersApi.update(editingUser.id, {
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          studentId: form.studentId.trim(),
          resetPasswordToStudentId,
        });
        const updated = normalizeUser(res.data);
        setUsers((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      } else {
        const res = await usersApi.create({
          username: form.username.trim(),
          fullName: form.fullName.trim(),
          studentId: form.studentId.trim(),
        });
        const created = normalizeUser(res.data);
        setUsers((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err: unknown) {
      const typedErr = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      const message = typedErr?.response?.data?.message;
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ບັນທຶກຜູ້ໃຊ້ບໍ່ສຳເລັດ",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      fullName: user.fullName,
      studentId: user.studentId,
    });
    setResetPasswordToStudentId(false);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleDelete = async (user: ManagedUser) => {
    const confirmed = window.confirm(
      `ຕ້ອງການລົບຜູ້ໃຊ້ "${user.username}" ຫຼືບໍ?`,
    );
    if (!confirmed) return;

    setDeletingId(user.id);
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
      setError(
        Array.isArray(message)
          ? message.join(", ")
          : message || typedErr?.message || "ລົບຜູ້ໃຊ້ບໍ່ສຳເລັດ",
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

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
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
      `Delete ${selectedUsers.length} selected user(s)?`,
    );
    if (!confirmed) return;

    setBulkDeleting(true);
    setError("");

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
        return;
      }
      failedUsers.push(user.username);
    });

    if (deletedIds.length > 0) {
      setUsers((prev) => prev.filter((user) => !deletedIds.includes(user.id)));
      setSelectedUserIds((prev) =>
        prev.filter((id) => !deletedIds.includes(id)),
      );
      if (editingUser && deletedIds.includes(editingUser.id)) {
        resetForm();
      }
      // Adjust current page if necessary
      setCurrentPage((prev) => {
        const newFilteredUsers = users.filter(
          (user) => !deletedIds.includes(user.id),
        );
        const newTotalPages = Math.ceil(newFilteredUsers.length / pageSize);
        return Math.min(prev, Math.max(1, newTotalPages));
      });
    }

    if (failedUsers.length > 0) {
      setError(`Delete failed for: ${failedUsers.join(", ")}`);
    }

    setBulkDeleting(false);
  };

  const stats = useMemo(
    () => ({
      total: users.length,
      filtered: filteredUsers.length,
      needPasswordChange: users.filter((user) => user.mustChangePassword)
        .length,
    }),
    [users, filteredUsers],
  );

  return (
    <AdminRoute>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                ຈັດການຜູ້ໃຊ້
              </h1>
              <p className="text-slate-500">
                ສ້າງ, ແກ້ໄຂ ແລະລົບບັນຊີຜູ້ໃຊ້. ລະຫັດຜ່ານເລີ່ມຕົ້ນແມ່ນມາຈາກ
                student ID
              </p>
            </div>
            <button
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              ເພີ່ມຜູ້ໃຊ້
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  ນຳເຂົ້າຜູ້ໃຊ້ຈາກ CSV
                </p>
                <p className="text-xs text-slate-500">
                  ຄໍລຳທີ່ຮອງຮັບ: username, fullName, studentId
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  ດາວໂຫຼດຕົວຢ່າງ
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <Upload className="h-4 w-4" />
                  ເລືອກໄຟລ໌ CSV
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
              <p className="mt-3 text-xs text-slate-500">ກຳລັງນຳເຂົ້າ CSV...</p>
            ) : null}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">ຈຳນວນຜູ້ໃຊ້ທັງໝົດ</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {stats.total}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">ຜູ້ໃຊ້ຫຼັງຄົ້ນຫາ</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {stats.filtered}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">ຕ້ອງປ່ຽນລະຫັດຜ່ານ</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {stats.needPasswordChange}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ຄົ້ນຫາ username, name ຫຼື student ID"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              />
            </div>

            {selectedUserIds.length > 0 && (
              <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-rose-50">
                <span className="text-sm text-slate-700">
                  ເລືອກ {selectedUserIds.length} ຜູ້ໃຊ້
                </span>
                <button
                  onClick={() => void handleDeleteSelected()}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  {bulkDeleting ? "ກຳລັງລົບ..." : "ລົບທີ່ເລືອກ"}
                </button>
              </div>
            )}

            {loading ? <LoadingState label="ກຳລັງໂຫຼດຜູ້ໃຊ້..." /> : null}

            {!loading && error ? (
              <div className="p-4">
                <ErrorState
                  title="ບໍ່ສາມາດໂຫຼດຜູ້ໃຊ້ໄດ້"
                  description={error}
                  action={
                    <button
                      onClick={fetchUsers}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                      ລອງອີກຄັ້ງ
                    </button>
                  }
                />
              </div>
            ) : null}

            {!loading && !error && filteredUsers.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="ຍັງບໍ່ມີຜູ້ໃຊ້"
                  description="ກົດເພີ່ມຜູ້ໃຊ້ເພື່ອສ້າງບັນຊີໃໝ່"
                />
              </div>
            ) : null}

            {!loading && !error && filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <input
                          type="checkbox"
                          ref={selectAllRef}
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Username
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Student ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        ສະຖານະ
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        ການກະທຳ
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
                        <td className="px-4 py-4 font-mono text-sm text-slate-900">
                          {user.username}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-700">
                          {user.fullName}
                        </td>
                        <td className="px-4 py-4 font-mono text-sm text-slate-600">
                          {user.studentId}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              user.mustChangePassword
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {user.mustChangePassword
                              ? "ຕ້ອງປ່ຽນລະຫັດ"
                              : "ພ້ອມໃຊ້ງານ"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50"
                              title="ແກ້ໄຂ"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => void handleDelete(user)}
                              disabled={deletingId === user.id}
                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white p-2 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              title="ລົບ"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {totalPages > 1 && (
                  <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div className="text-sm text-slate-700">
                      ສະແດງ{" "}
                      {Math.min(
                        (currentPage - 1) * pageSize + 1,
                        filteredUsers.length,
                      )}{" "}
                      ຫາ{" "}
                      {Math.min(currentPage * pageSize, filteredUsers.length)}{" "}
                      ຈາກ {filteredUsers.length} ຜູ້ໃຊ້
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ກ່ອນໜ້າ
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            const pageNum =
                              Math.max(
                                1,
                                Math.min(totalPages - 4, currentPage - 2),
                              ) + i;
                            if (pageNum > totalPages) return null;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                                  currentPage === pageNum
                                    ? "bg-indigo-600 text-white"
                                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          },
                        )}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        ຕໍ່ໄປ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ModalShell
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? "ແກ້ໄຂຜູ້ໃຊ້" : "ສ້າງຜູ້ໃຊ້ໃໝ່"}
        description="Username ແມ່ນໄວ້ເຂົ້າລະບົບ, student ID ແມ່ນລະຫັດຜ່ານເລີ່ມຕົ້ນ"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  username: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-300 focus:bg-white focus:outline-none"
              placeholder="somxay.sivilay"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Name
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
              ລະຫັດນັກສຶກສາ
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

          {editingUser ? (
            <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={resetPasswordToStudentId}
                onChange={(event) =>
                  setResetPasswordToStudentId(event.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>ຕັ້ງລະຫັດຜ່ານໃຫ້ກັບໄປເປັນ student ID ອີກຄັ້ງ</span>
            </label>
          ) : (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              ລະຫັດຜ່ານເລີ່ມຕົ້ນຈະຖືກ hash ຈາກ student ID
              ແລະບັນຊີຈະຖືກບັງຄັບປ່ຽນລະຫັດຫຼັງຈາກເຂົ້າລະບົບຄັ້ງທຳອິດ
            </div>
          )}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving
                ? "ກຳລັງບັນທຶກ..."
                : editingUser
                  ? "ບັນທຶກການແກ້ໄຂ"
                  : "ສ້າງຜູ້ໃຊ້"}
            </button>
          </div>
        </form>
      </ModalShell>
    </AdminRoute>
  );
}
