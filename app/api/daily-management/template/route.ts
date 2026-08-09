const TEMPLATE_NAME = "KMM_Daily_Management_Input_Template.xlsx";
const EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  const source = await fetch(new URL(`/${TEMPLATE_NAME}`, request.url), { cache: "no-store" });
  if (!source.ok) return Response.json({ error: "Daily Management Excel template is unavailable." }, { status: 404 });

  return new Response(await source.arrayBuffer(), {
    headers: {
      "Content-Type": EXCEL_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${TEMPLATE_NAME}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
