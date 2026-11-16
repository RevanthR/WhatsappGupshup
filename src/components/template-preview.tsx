import { splitParams } from "@/lib/template-vars";

export type PreviewTemplate = {
  body: string;
  header: string | null;
  footer: string | null;
  templateType: string;
  sampleMediaUrl?: string | null;
};

function fill(text: string, params: string[]) {
  const parts = text.split(/(\{\{\s*\d+\s*\}\})/g);
  return parts.map((part, i) => {
    const m = part.match(/^\{\{\s*(\d+)\s*\}\}$/);
    if (!m) return <span key={i}>{part}</span>;
    const v = params[Number(m[1]) - 1];
    return v ? (
      <span key={i} className="font-medium">{v}</span>
    ) : (
      <span key={i} className="rounded bg-amber-100 px-1 text-amber-800">{part}</span>
    );
  });
}

export function TemplatePreview({ template, params, mediaUrl }: { template: PreviewTemplate; params: string[]; mediaUrl?: string }) {
  const split = splitParams(template, params);
  mediaUrl = mediaUrl || template.sampleMediaUrl || undefined;
  const media = ["IMAGE", "VIDEO", "DOCUMENT"].includes(template.templateType);
  return (
    <div className="rounded-xl bg-[#efeae2] p-4">
      <div className="max-w-sm rounded-lg rounded-tl-none bg-white p-2.5 shadow-sm">
        {media ? (
          mediaUrl && template.templateType === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="mb-2 max-h-48 w-full rounded object-cover" />
          ) : (
            <div className="mb-2 flex h-24 items-center justify-center rounded bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
              {template.templateType.toLowerCase()}
            </div>
          )
        ) : null}
        {template.header ? <p className="mb-1 text-sm font-semibold text-gray-900">{fill(template.header, split.header)}</p> : null}
        <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{fill(template.body, split.body)}</p>
        {template.footer ? <p className="mt-1 text-xs text-gray-500">{template.footer}</p> : null}
      </div>
    </div>
  );
}
