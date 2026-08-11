const TEMPLATE_NAME = "KMM_Daily_Management_Input_Template.xlsx";
const EXCEL_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  return new Response(null, {
    status: 307,
    headers: {
      "Location": new URL(`/${TEMPLATE_NAME}`, request.url).toString(),
      "Content-Type": EXCEL_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${TEMPLATE_NAME}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
