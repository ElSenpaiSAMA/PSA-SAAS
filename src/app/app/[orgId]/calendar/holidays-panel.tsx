import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getHolidays } from "@/lib/data/calendar";
import { HolidaysEditor } from "./holidays-editor";

export async function HolidaysPanel({ orgId, year }: { orgId: string; year: number }) {
  const holidays = await getHolidays(orgId, `${year}-01-01`, `${year}-12-31`);
  return (
    <Card className="mt-6">
      <CardHeader
        title={`Festivos ${year}`}
        description="No cuentan como días de vacaciones y descuentan capacidad en la planificación."
      />
      <CardBody>
        <HolidaysEditor orgId={orgId} year={year} holidays={holidays.map((h) => ({ id: h.id, date: h.date, name: h.name }))} />
      </CardBody>
    </Card>
  );
}
