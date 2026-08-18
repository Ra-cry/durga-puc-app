import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import PucRecord from '@/models/PucRecord';
import { utils, write } from 'xlsx';
import { formatIST } from '@/lib/pucHelpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const type = searchParams.get('type') || 'old'; // 'old' | 'expired'

  try {
    const conn = await dbConnect();
    let records: any[] = [];
    const now = new Date();

    if (conn) {
      let query: Record<string, unknown> = {};
      let sortQuery: Record<string, 1 | -1> = { issuedAt: -1 };

      if (type === 'expired') {
        sortQuery = { validTill: -1 };
        if (startDate && endDate) {
          query = { validTill: { $gte: new Date(startDate), $lte: new Date(endDate) } };
        } else {
          query = { validTill: { $lt: now } };
        }
      } else {
        if (startDate && endDate) {
          query = { issuedAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
        }
      }
      records = await PucRecord.find(query).sort(sortQuery).lean();
    } else {
      const memoryList = global.__inMemoryPucRecords || [];
      if (type === 'expired') {
        if (startDate && endDate) {
          const s = new Date(startDate);
          const e = new Date(endDate);
          records = memoryList.filter((r) => {
            const d = new Date(r.validTill);
            return d >= s && d <= e;
          });
        } else {
          records = memoryList.filter((r) => new Date(r.validTill) < now);
        }
        records.sort((a, b) => new Date(b.validTill).getTime() - new Date(a.validTill).getTime());
      } else {
        if (startDate && endDate) {
          const s = new Date(startDate);
          const e = new Date(endDate);
          records = memoryList.filter((r) => {
            const d = new Date(r.issuedAt);
            return d >= s && d <= e;
          });
        } else {
          records = [...memoryList];
        }
        records.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
      }
    }

    const sheetData = records.map((r) => ({
      'Vehicle No': r.vehicleNo,
      Class: r.vehicleClass || 'CAR',
      'BS Stage': r.bsStage,
      Fuel: r.fuelType,
      'Customer Name': r.customerName,
      'Customer Phone': r.customerPhone,
      Agent: r.agent || '',
      'Issued Date': formatIST(new Date(r.issuedAt)),
      'Valid Till': formatIST(new Date(r.validTill)),
      Status: new Date(r.validTill) < now ? 'Expired' : 'Active',
    }));

    const worksheet = utils.json_to_sheet(sheetData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'PUC Records');

    const colWidths = Object.keys(sheetData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    worksheet['!cols'] = colWidths;

    const excelBuffer = write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `puc-records-${type}-${new Date().toISOString().split('T')[0]}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
