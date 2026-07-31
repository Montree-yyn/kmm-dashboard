import { Card } from "../ui/card";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#F8FAFC] text-[#1F2937]">
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
          <Card className="grid min-h-[420px] place-items-center p-8 text-center">
            <div className="max-w-sm">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#FFF4E9] text-xl font-bold text-[#E86F00]">{title.slice(0, 1)}</span>
              <h2 className="mt-5 text-xl font-bold text-[#1F2937]">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">This page is ready for future content.</p>
            </div>
          </Card>
      </main>
    </div>
  );
}
