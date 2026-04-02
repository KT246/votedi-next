export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">
            {"ກຳລັງເຂົ້າຫ້ອງເລືອກຕັ້ງ..."}
          </p>
        </div>
      </div>
    </div>
  );
}
