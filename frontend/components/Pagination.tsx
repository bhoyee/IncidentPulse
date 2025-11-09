type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-300">
      <p>
        Page <span className="font-semibold text-white">{page}</span> of{" "}
        <span className="font-semibold text-white">{totalPages}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-gray-600 px-3 py-1 text-xs font-semibold text-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-gray-600 px-3 py-1 text-xs font-semibold text-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
