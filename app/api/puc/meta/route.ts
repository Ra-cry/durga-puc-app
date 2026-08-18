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
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const type = searchParams.get('type') || 'old'; // 'old' | 'expired'

  try {
    const conn = await dbConnect();
    const dateField = type === 'expired' ? 'validTill' : 'issuedAt';

    const yearSet = new Set<number>();
    const monthsByYear: Record<number, Set<number>> = {};
    const daysByYearMonth: Record<string, Set<number>> = {};

    if (conn) {
      const results = await PucRecord.aggregate([
        {
          $match: {
            [dateField]: { $ne: null, $exists: true },
          },
        },
        {
          $project: {
            year: { $year: { date: `$${dateField}`, timezone: 'Asia/Kolkata' } },
            month: { $month: { date: `$${dateField}`, timezone: 'Asia/Kolkata' } },
            day: { $dayOfMonth: { date: `$${dateField}`, timezone: 'Asia/Kolkata' } },
          },
        },
        {
          $group: {
            _id: { year: '$year', month: '$month', day: '$day' },
          },
        },
      ]);

      for (const item of results) {
        const y = item._id.year;
        const m = item._id.month;
        const d = item._id.day;
        if (!y || !m || !d) continue;

        yearSet.add(y);
        if (!monthsByYear[y]) monthsByYear[y] = new Set();
        monthsByYear[y].add(m);

        const key = `${y}-${m}`;
        if (!daysByYearMonth[key]) daysByYearMonth[key] = new Set();
        daysByYearMonth[key].add(d);
      }
    } else {
      const memoryList = global.__inMemoryPucRecords || [];
      for (const doc of memoryList) {
        const rawDate = doc[dateField as keyof typeof doc] as Date | string;
        if (!rawDate) continue;
        const d = toZonedTime(new Date(rawDate), IST);
        if (isNaN(d.getTime())) continue;

        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();

        yearSet.add(y);
        if (!monthsByYear[y]) monthsByYear[y] = new Set();
        monthsByYear[y].add(m);

        const key = `${y}-${m}`;
        if (!daysByYearMonth[key]) daysByYearMonth[key] = new Set();
        daysByYearMonth[key].add(day);
      }
    }

    const years = Array.from(yearSet).sort((a, b) => b - a);

    if (!yearParam) {
      return NextResponse.json({
        years,
        months: [],
        days: [],
      });
    }

    const targetYear = parseInt(yearParam);
    const months = Array.from(monthsByYear[targetYear] || []).sort((a, b) => a - b);

    if (!monthParam) {
      return NextResponse.json({
        years,
        months,
        days: [],
      });
    }

    const targetMonth = parseInt(monthParam);
    const key = `${targetYear}-${targetMonth}`;
    const days = Array.from(daysByYearMonth[key] || []).sort((a, b) => a - b);

    return NextResponse.json({
      years,
      months,
      days,
    });
  } catch (err: any) {
    console.error('Meta fetch error:', err);
    return NextResponse.json({
      years: [],
      months: [],
      days: [],
    });
  }
}
