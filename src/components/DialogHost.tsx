"use client";
import { useDialogStore } from '../store/dialogStore';
import ModalShell from './ui/ModalShell';

export default function DialogHost() {
        const alert = useDialogStore((state) => state.alert);
    const confirm = useDialogStore((state) => state.confirm);
    const closeAlert = useDialogStore((state) => state.closeAlert);
    const resolveConfirm = useDialogStore((state) => state.resolveConfirm);

    return (
        <>
            {alert.open ? (
                <ModalShell
                    open={alert.open}
                    title={alert.title}
                    onClose={closeAlert}
                    maxWidthClass="max-w-sm"
                >
                    <p className="text-sm leading-relaxed text-slate-600">{alert.message}</p>
                    <button
                        type="button"
                        onClick={closeAlert}
                        className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                        {'ປິດ'}
                    </button>
                </ModalShell>
            ) : null}

            {confirm.open ? (
                <ModalShell
                    open={confirm.open}
                    title={confirm.title}
                    onClose={() => resolveConfirm(false)}
                    maxWidthClass="max-w-sm"
                >
                    <p className="text-sm leading-relaxed text-slate-600">{confirm.message}</p>
                    <div className="mt-5 flex gap-3">
                        <button
                            type="button"
                            onClick={() => resolveConfirm(false)}
                            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            {'ຍົກເລີກ'}
                        </button>
                        <button
                            type="button"
                            onClick={() => resolveConfirm(true)}
                            className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                        >
                            {'ຢືນຢັນ'}
                        </button>
                    </div>
                </ModalShell>
            ) : null}
        </>
    );
}
