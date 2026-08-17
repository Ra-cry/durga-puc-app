import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PucRecord from '@/models/PucRecord';
import { toZonedTime } from 'date-fns-tz';
import { IST } from '@/lib/pucHelpers';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const type = searchParams.get('type') || 'old'; // 'old' | 'expired'

  try {
    await dbConnect();

    const dateField = type === 'expired' ? 'validTill' : 'issuedAt';

    // Get distinct years
    const allDocs = await PucRecord.find({}, { [dateField]: 1 }).lean();

    const yearSet = new Set<number>();
    const monthsByYear: Record<number, Set<number>> = {};
    const weeksByYearMonth: Record<string, Set<number>> = {};

    for (const doc of allDocs) {
      const rawDate = doc[dateField as keyof typeof doc] as Date;
      if (!rawDate) continue;
      const d = toZonedTime(new Date(rawDate), IST);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      const week = Math.ceil(day / 7);

      yearSet.add(y);
      if (!monthsByYear[y]) monthsByYear[y] = new Set();
      monthsByYear[y].add(m);

      const key = `${y}-${m}`;
      if (!weeksByYearMonth[key]) weeksByYearMonth[key] = new Set();
      weeksByYearMonth[key].add(week);
    }

    const years = Array.from(yearSet).sort((a, b) => b - a);

    if (!year) {
      return NextResponse.json({ years });
    }

    const months = Array.from(monthsByYear[parseInt(year)] || []).sort((a, b) => a - b);

    if (!month) {
      return NextResponse.json({ years, months });
    }

    const key = `${year}-${month}`;
    const weeks = Array.from(weeksByYearMonth[key] || []).sort((a, b) => a - b);

    return NextResponse.json({ years, months, weeks });
  } catch (err) {
    return NextResponse.json({ years: [], months: [], weeks: [] });
  }
}
