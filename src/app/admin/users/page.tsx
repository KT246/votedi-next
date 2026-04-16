"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, PencilLine, Plus, Trash2, Upload } from "lucide-react";

import { usersApi } from "../../../api/usersApi";
import AdminRoute from "../../../components/AdminRoute";
import EmptyState from "../../../components/ui/EmptyState";
import ErrorState from "../../../components/ui/ErrorState";
import LoadingState from "../../../components/ui/LoadingState";
import ModalShell from "../../../components/ui/ModalShell";
import PageHeader from "../../../components/ui/PageHeader";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";

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
  const debouncedSearch = useDebouncedValue(search, 1000);

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
          : message || typedErr?.message || "ບໍ່ສາມາດໂຫຼດລາຍຊື່ຜູ້ໂຫວດໄດ້",
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
  }, [debouncedSearch]);

  const filteredUsers = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return users;

    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(query) ||
        user.studentId.toLowerCase().includes(query),
    );
  }, [debouncedSearch, users]);

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
    void (async () => {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(
        users.map((user) => ({
          fullName: user.fullName,
          studentId: user.studentId,
        })),
      );
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Voters");
      XLSX.writeFile(workbook, "voters-export.xlsx");
    })();
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
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setImportError("Excel file does not contain any worksheet.");
        return;
      }

      const worksheet = workbook.Sheets[firstSheetName];
      const parsedRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: "",
      });

      const rows = parsedRows
        .map(normalizeImportRow)
        .filter((row) => row.fullName || row.studentId);

      if (rows.length === 0) {
        setImportError("Excel file does not contain any importable rows.");
        return;
      }

      const res = await usersApi.importExcelRows(rows);
      const created = Array.isArray(res.data?.created)
        ? res.data.created.map(normalizeUser)
        : [];
      const skipped = Array.isArray(res.data?.skipped) ? res.data.skipped : [];

      if (created.length > 0) {
        setUsers((prev) => [...created, ...prev]);
        setCurrentPage(1);
      }

      setImportMessage(
        `ນຳເຂົ້າສຳເລັດ ${created.length} ແຖວ${
          skipped.length > 0 ? `, ຂ້າມ ${skipped.length} ແຖວ` : ""
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
          : message || typedErr?.message || "ນຳເຂົ້າ Excel ບໍ່ສຳເລັດ",
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");

    if (!form.fullName.trim() || !form.studentId.trim()) {
      setFormError("ກະລຸນາປ້ອນຊື່-ນາມສະກຸນ ແລະ ລະຫັດນັກສຶກສາ");
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
          : message || typedErr?.message || "ບໍ່ສາມາດບັນທຶກຜູ້ໂຫວດໄດ້",
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
    const confirmed = window.confirm(`ຕ້ອງການລົບຜູ້ໂຫວດ "${label}" ຫຼືບໍ?`);
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
          : message || typedErr?.message || "ບໍ່ສາມາດລົບຜູ້ໂຫວດໄດ້",
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
      `ຕ້ອງການລົບຜູ້ໂຫວດທີ່ເລືອກ ${selectedUsers.length} ລາຍການຫຼືບໍ?`,
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
      setPageError(`ລົບບໍ່ສຳເລັດ: ${failedUsers.join(", ")}`);
    }

    setBulkDeleting(false);
  };

  return (
    <AdminRoute>
      <div className="admin-page">
        <div className="admin-page-container space-y-6">
          <PageHeader
            title="ຈັດການຜູ້ໂຫວດ"
            subtitle="ຂໍ້ມູນຜູ້ໂຫວດໃຊ້ຊື່-ນາມສະກຸນ ແລະ ລະຫັດນັກສຶກສາ"
            actions={
              <button
                type="button"
                onClick={handleCreate}
                className="admin-btn-primary"
              >
                <Plus className="h-4 w-4" />
                ເພີ່ມຜູ້ໂຫວດ
              </button>
            }
          />

          <div className="admin-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">
                  ນຳເຂົ້າຈາກ Excel
                </p>
                <p className="text-xs text-[var(--admin-text-muted)]">
                  ຄໍລຳທີ່ຮອງຮັບ: `fullName`, `studentId`
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadUsers}
                  className="admin-btn-secondary"
                >
                  <Download className="h-4 w-4" />
                  ສົ່ງອອກຜູ້ໂຫວດ Excel
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="admin-btn-primary"
                >
                  <Upload className="h-4 w-4" />
                  ເລືອກໄຟລ໌ Excel
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>
            </div>

            {importError ? (
              <p className="mt-3 text-sm text-rose-600">{importError}</p>
            ) : null}
            {importMessage ? (
              <p className="mt-3 text-sm text-emerald-700">{importMessage}</p>
            ) : null}
            {importing ? (
              <p className="mt-3 text-xs text-[var(--admin-text-muted)]">
                ກຳລັງນຳເຂົ້າ Excel...
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="admin-stat-card p-5">
              <p className="text-sm text-[var(--admin-text-muted)]">ຜູ້ໂຫວດທັງໝົດ</p>
              <p className="mt-2 text-3xl font-bold text-[var(--admin-text)]">
                {stats.total}
              </p>
            </div>
            <div className="admin-stat-card p-5">
              <p className="text-sm text-[var(--admin-text-muted)]">ຕາມຕົວກອງ</p>
              <p className="mt-2 text-3xl font-bold text-[var(--admin-text)]">
                {stats.filtered}
              </p>
            </div>
            <div className="admin-stat-card p-5">
              <p className="text-sm text-[var(--admin-text-muted)]">ທີ່ເລືອກ</p>
              <p className="mt-2 text-3xl font-bold text-[var(--admin-text)]">
                {stats.selected}
              </p>
            </div>
          </div>

          <div className="admin-table-shell">
            <div className="border-b border-[var(--admin-border)] p-4">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ຄົ້ນຫາດ້ວຍຊື່ ຫຼື ລະຫັດນັກສຶກສາ"
                className="admin-input"
              />
            </div>

            {selectedUserIds.length > 0 ? (
              <div className="flex items-center justify-between border-b border-rose-200 bg-[#fcf1f2] px-4 py-3">
                <span className="text-sm text-[var(--admin-text)]">
                  ເລືອກແລ້ວ {selectedUserIds.length} ລາຍການ
                </span>
                <button
                  type="button"
                  onClick={() => void handleDeleteSelected()}
                  disabled={bulkDeleting}
                  className="admin-btn-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  {bulkDeleting ? "ກຳລັງລົບ..." : "ລົບທີ່ເລືອກ"}
                </button>
              </div>
            ) : null}

            {loading ? <LoadingState label="ກຳລັງໂຫຼດຜູ້ໂຫວດ..." /> : null}

            {!loading && pageError ? (
              <div className="p-4">
                <ErrorState
                  title="ໂຫຼດຜູ້ໂຫວດບໍ່ສຳເລັດ"
                  description={pageError}
                  action={
                    <button
                      type="button"
                      onClick={() => void fetchUsers()}
                      className="admin-btn-primary"
                    >
                      ລອງອີກຄັ້ງ
                    </button>
                  }
                />
              </div>
            ) : null}

            {!loading && !pageError && filteredUsers.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="ຍັງບໍ່ມີຜູ້ໂຫວດ"
                  description="ເພີ່ມຜູ້ໂຫວດເອງ ຫຼື ນຳເຂົ້າຈາກ Excel"
                />
              </div>
            ) : null}

            {!loading && !pageError && filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-[var(--admin-border)]">
                  <thead className="admin-table-head">
                    <tr>
                      <th className="admin-table-header-cell px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          ref={selectAllRef}
                          checked={allPageSelected}
                          onChange={toggleSelectAllOnPage}
                          className="admin-checkbox"
                        />
                      </th>
                      <th className="admin-table-header-cell px-4 py-3 text-left">
                        ຊື່-ນາມສະກຸນ
                      </th>
                      <th className="admin-table-header-cell px-4 py-3 text-left">
                        ລະຫັດນັກສຶກສາ
                      </th>
                      <th className="admin-table-header-cell px-4 py-3 text-left">
                        ສ້າງເມື່ອ
                      </th>
                      <th className="admin-table-header-cell px-4 py-3 text-right">
                        ຈັດການ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="admin-table-row">
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={() => toggleUserSelection(user.id)}
                            className="admin-checkbox"
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
                              className="admin-icon-btn"
                              title="ແກ້ໄຂ"
                            >
                              <PencilLine className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(user)}
                              disabled={deletingId === user.id}
                              className="admin-icon-btn-danger"
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

                {totalPages > 1 ? (
                  <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
                    <div className="text-sm text-[var(--admin-text)]">
                      ສະແດງ {(safeCurrentPage - 1) * pageSize + 1}-
                      {Math.min(safeCurrentPage * pageSize, filteredUsers.length)} ຈາກ{" "}
                      {filteredUsers.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={safeCurrentPage === 1}
                        className="admin-btn-secondary px-3 py-1.5"
                      >
                        ກ່ອນໜ້າ
                      </button>
                      <span className="text-sm text-[var(--admin-text-muted)]">
                        ໜ້າ {safeCurrentPage} / {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={safeCurrentPage === totalPages}
                        className="admin-btn-secondary px-3 py-1.5"
                      >
                        ຕໍ່ໄປ
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
        title={editingUser ? "ແກ້ໄຂຜູ້ໂຫວດ" : "ເພີ່ມຜູ້ໂຫວດ"}
        description="ຂໍ້ມູນຜູ້ໂຫວດໃຊ້ຊື່-ນາມສະກຸນ ແລະ ລະຫັດນັກສຶກສາເທົ່ານັ້ນ"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              ຊື່-ນາມສະກຸນ
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
              className="admin-input"
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
              className="admin-input"
              placeholder="20230001"
            />
          </div>

          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="admin-btn-secondary flex-1"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="admin-btn-primary flex-1"
            >
              {saving
                ? "ກຳລັງບັນທຶກ..."
                : editingUser
                  ? "ບັນທຶກ"
                  : "ເພີ່ມຜູ້ໂຫວດ"}
            </button>
          </div>
        </form>
      </ModalShell>
    </AdminRoute>
  );
}
