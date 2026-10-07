import type { NextRequest } from "next/server";
import {
  ABSENCES_COLUMNS,
  availableReports,
  BILLING_COLUMNS,
  getAbsencesReport,
  getBillingReport,
  getHoursReport,
  hoursColumns,
  type ReportType,
} from "@/lib/data/reports";
import { getOrgContext } from "@/lib/data/session";
import { monthStart, parseMonthParam, todayISO, toMonthParam } from "@/lib/domain/periods";
import { toCsv } from "@/lib/domain/reports";

const isReport = (v: string | null): v is ReportType => v === "facturacion" || v === "horas" || v === "ausencias";

/** Descarga el informe del mes en CSV (Excel en español). Mismos datos y permisos que la página. */
export async function GET(request: NextRequest, ctx: RouteContext<"/app/[orgId]/reports/export">) {
  const { orgId } = await ctx.params;
  const { organization } = await getOrgContext(orgId);
  const type = request.nextUrl.searchParams.get("type");
  const month = parseMonthParam(request.nextUrl.searchParams.get("month")) ?? monthStart(todayISO());

  if (!isReport(type) || !(await availableReports(orgId)).includes(type)) {
    return new Response("No tenés acceso a este informe.", { status: 403 });
  }

  let csv: string;
  if (type === "facturacion") {
    const { rows } = await getBillingReport(orgId, month);
    csv = toCsv(rows, BILLING_COLUMNS);
  } else if (type === "horas") {
    const { rows, projects } = await getHoursReport(orgId, month);
    csv = toCsv(rows, hoursColumns(projects));
  } else {
    csv = toCsv(await getAbsencesReport(orgId, month), ABSENCES_COLUMNS);
  }

  const slug = organization.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();
  const filename = `${type}-${toMonthParam(month)}-${slug}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
