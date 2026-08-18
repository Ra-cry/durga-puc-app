import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PucRecord from '@/models/PucRecord';
import { toZonedTime } from 'date-fns-tz';
import { IST, nowIST } from '@/lib/pucHelpers';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  const type = searchParams.get('type') || 'old'; // 'old' | 'expired'

  try {
    const conn = await dbConnect();
    const dateField = type === 'expired' ? 'validTill' : 'issuedAt';
    const now = nowIST();

    let allDocs: any[] = [];
    if (conn) {
      const matchQuery: Record<string, unknown> = {};
      if (type === 'expired') {
        matchQuery.validTill = { $lt: now };
      }
      allDocs = await PucRecord.find(matchQuery, { [dateField]: 1 }).lean();
    } else {
      let memoryList = global.__inMemoryPucRecords || [];
      if (type === 'expired') {
        memoryList = memoryList.filter((r) => new Date(r.validTill) < now);
      }
      allDocs = memoryList;
    }

    const yearSet = new Set<number>();
    const monthsByYear: Record<number, Set<number>> = {};
    const weeksByYearMonth: Record<string, Set<number>> = {};
    const daysByYearMonth: Record<string, Set<number>> = {};

    for (const doc of allDocs) {
      const rawDate = doc[dateField as keyof typeof doc] as Date | string;
      if (!rawDate) continue;
      const d = toZonedTime(new Date(rawDate), IST);
      if (isNaN(d.getTime())) continue;

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

      if (!daysByYearMonth[key]) daysByYearMonth[key] = new Set();
      daysByYearMonth[key].add(day);
    }

    // Combine discovered years with standard active range
    const currentY = new Date().getFullYear();
    yearSet.add(currentY);
    yearSet.add(2024);
    yearSet.add(2025);
    yearSet.add(2026);
    yearSet.add(2027);

    const years = Array.from(yearSet).sort((a, b) => b - a);

    if (!year) {
      return NextResponse.json({ years, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], weeks: [], days: [] });
    }

    const targetYear = parseInt(year);
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    if (!month) {
      return NextResponse.json({ years, months, weeks: [], days: [] });
    }

    const targetMonth = parseInt(month);
    const key = `${targetYear}-${targetMonth}`;
    const weeks = Array.from(weeksByYearMonth[key] || []).sort((a, b) => a - b);
    const days = Array.from(daysByYearMonth[key] || []).sort((a, b) => a - b);

    return NextResponse.json({ years, months, weeks, days });
  } catch {
    return NextResponse.json({
      years: [2027, 2026, 2025, 2024],
      months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      weeks: [],
      days: [],
    });
  }
}

