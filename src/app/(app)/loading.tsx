export default function Loading() {
  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-100">
        <div className="indeterminate h-full w-1/3 bg-brand-600" />
      </div>
      <div className="animate-pulse space-y-4">
        <div className="h-7 w-48 rounded bg-gray-200" />
        <div className="h-4 w-72 rounded bg-gray-200" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 rounded-xl bg-gray-200" />
          <div className="h-28 rounded-xl bg-gray-200" />
          <div className="h-28 rounded-xl bg-gray-200" />
        </div>
        <div className="h-64 rounded-xl bg-gray-200" />
      </div>
    </>
  );
}
